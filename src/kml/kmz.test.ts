import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { ValidationError } from "@/server/validation";
import {
  bytesToDataUri,
  extractKml,
  inlineKmzAssets,
  looksLikeZip,
  MAX_KML_BYTES,
  mergeKmlDocuments,
  networkLinkHrefs,
} from "./kmz";

const KML = '<?xml version="1.0"?><kml><Document/></kml>';
const toBytes = (s: string): Uint8Array => new TextEncoder().encode(s);

describe("looksLikeZip", () => {
  it("recognises the ZIP/KMZ magic bytes", () => {
    expect(looksLikeZip(zipSync({ "doc.kml": strToU8(KML) }))).toBe(true);
  });

  it("rejects plain KML text", () => {
    expect(looksLikeZip(toBytes(KML))).toBe(false);
  });
});

describe("extractKml", () => {
  it("returns plain KML text unchanged", () => {
    expect(extractKml(toBytes(KML))).toBe(KML);
  });

  it("unpacks a KMZ and returns its doc.kml", () => {
    const kmz = zipSync({ "doc.kml": strToU8(KML) });
    expect(extractKml(kmz)).toBe(KML);
  });

  it("prefers doc.kml over other .kml entries", () => {
    const kmz = zipSync({
      "images/other.kml": strToU8("<kml>other</kml>"),
      "doc.kml": strToU8(KML),
    });
    expect(extractKml(kmz)).toBe(KML);
  });

  it("falls back to the first .kml when there is no doc.kml", () => {
    const kmz = zipSync({ "WTH26 all courses.kml": strToU8(KML) });
    expect(extractKml(kmz)).toBe(KML);
  });

  it("rejects a KMZ without any KML entry", () => {
    const kmz = zipSync({ "images/pin.png": strToU8("not kml") });
    expect(() => extractKml(kmz)).toThrow(ValidationError);
  });

  it("rejects a corrupt ZIP archive", () => {
    // ZIP-Signatur, aber danach Müll.
    const corrupt = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    expect(() => extractKml(corrupt)).toThrow(ValidationError);
  });

  it("rejects a KMZ whose decompressed size exceeds the cap (zip bomb)", () => {
    const kmz = zipSync({ "doc.kml": strToU8("x".repeat(100)) });
    expect(() => extractKml(kmz, 10)).toThrow(ValidationError);
  });

  it("extracts a KMZ that stays within the cap", () => {
    const kmz = zipSync({ "doc.kml": strToU8(KML) });
    expect(extractKml(kmz, MAX_KML_BYTES)).toBe(KML);
  });

  it("inlines a bundled image referenced by relative href", () => {
    const kml =
      "<kml><Document><Placemark><Style><IconStyle><Icon>" +
      "<href>images/icon.png</href></Icon></IconStyle></Style>" +
      "</Placemark></Document></kml>";
    const kmz = zipSync({
      "doc.kml": strToU8(kml),
      "images/icon.png": strToU8("PNGBYTES"),
    });
    const out = extractKml(kmz);
    expect(out).toContain("data:image/png;base64,");
    expect(out).not.toContain("images/icon.png");
  });
});

describe("bytesToDataUri", () => {
  it("base64-encodes bytes with the given MIME type", () => {
    // "Man" → base64 "TWFu" (klassisches RFC-4648-Beispiel).
    expect(bytesToDataUri(toBytes("Man"), "image/png")).toBe(
      "data:image/png;base64,TWFu",
    );
  });

  it("encodes large buffers without a call-stack overflow", () => {
    const big = new Uint8Array(200_000).fill(65); // 200 KB "A"
    expect(bytesToDataUri(big, "image/png")).toMatch(
      /^data:image\/png;base64,QUFB/,
    );
  });
});

describe("inlineKmzAssets", () => {
  const entries = { "images/icon.png": strToU8("Man") };

  it("rewrites a matching href to a data URI", () => {
    const kml = "<Icon><href>images/icon.png</href></Icon>";
    expect(inlineKmzAssets(kml, entries, "doc.kml")).toBe(
      "<Icon><href>data:image/png;base64,TWFu</href></Icon>",
    );
  });

  it("matches a leading ./ and is case-insensitive on the path", () => {
    const kml = "<href>./Images/Icon.PNG</href>";
    expect(inlineKmzAssets(kml, entries, "doc.kml")).toContain(
      "data:image/png;base64,TWFu",
    );
  });

  it("leaves absolute and unknown hrefs untouched", () => {
    const kml =
      "<href>https://www.gstatic.com/x.png</href><href>missing.png</href>";
    expect(inlineKmzAssets(kml, entries, "doc.kml")).toBe(kml);
  });

  it("trims whitespace around the href", () => {
    const kml = "<href>\n  images/icon.png  \n</href>";
    expect(inlineKmzAssets(kml, entries, "doc.kml")).toBe(
      "<href>data:image/png;base64,TWFu</href>",
    );
  });

  it("inlines every matching href and keeps the text between them", () => {
    const kml =
      "<a><href>images/icon.png</href><b/><href>images/icon.png</href>";
    expect(inlineKmzAssets(kml, entries, "doc.kml")).toBe(
      "<a><href>data:image/png;base64,TWFu</href><b/><href>data:image/png;base64,TWFu</href>",
    );
  });

  it.each([
    ["contains <", "<href><![CDATA[images/icon.png]]></href>"],
    ["is empty", "<href></href>"],
    ["is not closed", "<href>images/icon.png"],
    ["is written in capitals", "<HREF>images/icon.png</HREF>"],
  ])("leaves an href alone that %s", (_case, kml) => {
    expect(inlineKmzAssets(kml, entries, "doc.kml")).toBe(kml);
  });

  it("does not inline the KML entry itself", () => {
    const kml = "<href>doc.kml</href>";
    const withDoc = { "doc.kml": strToU8("x"), ...entries };
    expect(inlineKmzAssets(kml, withDoc, "doc.kml")).toBe(kml);
  });
});

describe("networkLinkHrefs", () => {
  it("extracts the href from a Google My-Maps stub", () => {
    const stub = `<kml><Document><NetworkLink><name>x</name>
      <Link><href>https://www.google.com/maps/d/u/0/kml?mid=ABC</href></Link>
      </NetworkLink></Document></kml>`;
    expect(networkLinkHrefs(stub)).toEqual([
      "https://www.google.com/maps/d/u/0/kml?mid=ABC",
    ]);
  });

  it("supports the legacy <Url> element and multiple links", () => {
    const kml = `<kml>
      <NetworkLink><Url><href>https://a.example/x.kml</href></Url></NetworkLink>
      <NetworkLink><Link><href>https://b.example/y.kmz</href></Link></NetworkLink>
    </kml>`;
    expect(networkLinkHrefs(kml)).toEqual([
      "https://a.example/x.kml",
      "https://b.example/y.kmz",
    ]);
  });

  it("ignores non-http hrefs and KML without network links", () => {
    expect(
      networkLinkHrefs(
        "<NetworkLink><Link><href>files/local.kml</href></Link></NetworkLink>",
      ),
    ).toEqual([]);
    expect(networkLinkHrefs("<kml><Placemark/></kml>")).toEqual([]);
  });

  it("ignores the case of the tag names", () => {
    expect(
      networkLinkHrefs(
        "<networklink><Link><HREF>https://a.example/x.kml</HREF></Link></NETWORKLINK>",
      ),
    ).toEqual(["https://a.example/x.kml"]);
  });

  it("finds a NetworkLink with attributes but not a NetworkLinkControl", () => {
    const kml = `<NetworkLinkControl><href>https://a.example/c.kml</href></NetworkLinkControl>
      <NetworkLink id="n1"><Link><href>https://b.example/y.kml</href></Link></NetworkLink>`;
    expect(networkLinkHrefs(kml)).toEqual(["https://b.example/y.kml"]);
  });

  it("trims whitespace around the href and takes the first href in a link", () => {
    const kml = `<NetworkLink><Link><href>
        https://a.example/x.kml
      </href></Link><Url><href>https://b.example/y.kml</href></Url></NetworkLink>`;
    expect(networkLinkHrefs(kml)).toEqual(["https://a.example/x.kml"]);
  });

  it("finds the href after names whose lower case is longer, like İ", () => {
    const kml = `<Document><name>${"İ".repeat(30)}</name><NetworkLink><Link><href>https://a.example/x.kml</href></Link></NetworkLink></Document>`;
    expect(networkLinkHrefs(kml)).toEqual(["https://a.example/x.kml"]);
  });

  it("finds nothing when the last NetworkLink tag never ends", () => {
    expect(networkLinkHrefs("</NetworkLink><NetworkLink")).toEqual([]);
  });

  it("ignores a NetworkLink or href that is not closed", () => {
    expect(
      networkLinkHrefs(
        "<NetworkLink><Link><href>https://a.example/x.kml</Link></NetworkLink>",
      ),
    ).toEqual([]);
    expect(
      networkLinkHrefs(
        "<NetworkLink><Link><href>https://a.example/x.kml</href></Link>",
      ),
    ).toEqual([]);
  });
});

describe("mergeKmlDocuments", () => {
  const bodyOf = (doc: string): string => {
    const merged = mergeKmlDocuments([doc, "<kml/>"]);
    const start = merged.indexOf("<Document>") + "<Document>".length;
    return merged.slice(start, merged.lastIndexOf("</Document>"));
  };

  it("takes everything from the first Document to the last </Document>, nested ones included", () => {
    expect(
      bodyOf(
        '<kml><Document id="d"><Document><Placemark>A</Placemark></Document><Folder/></document></kml>',
      ),
    ).toBe("<Document><Placemark>A</Placemark></Document><Folder/>");
  });

  it("adds nothing for a document without a Document element or with an unclosed one", () => {
    expect(bodyOf("<kml><Folder><Placemark>A</Placemark></Folder></kml>")).toBe(
      "",
    );
    expect(bodyOf("<kml><Document><Placemark>A</Placemark></kml>")).toBe("");
    expect(bodyOf("<kml></Document><Document")).toBe("");
  });

  it("returns a single document unchanged", () => {
    const doc = "<kml><Document><Placemark/></Document></kml>";
    expect(mergeKmlDocuments([doc])).toBe(doc);
  });

  it("combines the bodies of several documents into one", () => {
    const merged = mergeKmlDocuments([
      "<kml><Document><Placemark>A</Placemark></Document></kml>",
      "<kml><Document><Placemark>B</Placemark></Document></kml>",
    ]);
    expect(merged).toContain("<Placemark>A</Placemark>");
    expect(merged).toContain("<Placemark>B</Placemark>");
    expect((merged.match(/<Document>/g) ?? []).length).toBe(1);
  });
});
