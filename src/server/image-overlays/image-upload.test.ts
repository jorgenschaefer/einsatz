import { describe, expect, it } from "vitest";
import { ValidationError } from "@/server/validation";
import {
  classifyUpload,
  enforceUploadSize,
  MAX_UPLOAD_BYTES,
} from "./image-upload";

describe("enforceUploadSize", () => {
  it("accepts a file within the 20 MB cap", () => {
    expect(() => enforceUploadSize(MAX_UPLOAD_BYTES)).not.toThrow();
  });

  it("rejects a file over the cap", () => {
    expect(() => enforceUploadSize(MAX_UPLOAD_BYTES + 1)).toThrow(
      ValidationError,
    );
  });
});

describe("classifyUpload", () => {
  it("accepts PNG and PDF by content-type", () => {
    expect(classifyUpload("image/png", "x")).toBe("png");
    expect(classifyUpload("application/pdf", "x")).toBe("pdf");
  });

  it("falls back to the filename extension", () => {
    expect(classifyUpload("application/octet-stream", "plan.PNG")).toBe("png");
    expect(classifyUpload("application/octet-stream", "plan.pdf")).toBe("pdf");
  });

  it("rejects other formats", () => {
    expect(() => classifyUpload("image/jpeg", "plan.jpg")).toThrow(
      ValidationError,
    );
  });
});
