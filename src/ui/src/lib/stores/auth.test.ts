import { syncBrowserAccessToken } from "./auth";

describe("syncBrowserAccessToken", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("writes the persisted token when present", () => {
    syncBrowserAccessToken("persisted-token");

    expect(window.localStorage.getItem("ds_access_token")).toBe("persisted-token");
  });

  it("preserves an existing runtime token when persisted state is empty", () => {
    window.localStorage.setItem("ds_access_token", "runtime-token");

    syncBrowserAccessToken(null);

    expect(window.localStorage.getItem("ds_access_token")).toBe("runtime-token");
  });

  it("keeps storage empty when no token exists anywhere", () => {
    syncBrowserAccessToken(null);

    expect(window.localStorage.getItem("ds_access_token")).toBeNull();
  });
});
