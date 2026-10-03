/** Runs once when the server starts, in every runtime Next compiles for. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { refuseToStartWithoutTiles } = await import("./startup-checks");
    refuseToStartWithoutTiles();
  }
}
