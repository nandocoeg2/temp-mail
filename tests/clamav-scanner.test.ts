import { describe, expect, it } from "vitest";
import { buildClamAvInstreamPayload, parseClamAvResponse } from "@/lib/server/clamav-scanner";

describe("ClamAV scanner", () => {
  it("builds INSTREAM payloads and parses infected signatures", () => {
    const payload = buildClamAvInstreamPayload(Buffer.from("hello"));
    const length = payload.readUInt32BE("zINSTREAM\0".length);

    expect(payload.subarray(0, "zINSTREAM\0".length).toString()).toBe("zINSTREAM\0");
    expect(length).toBe(5);
    expect(payload.subarray("zINSTREAM\0".length + 4, "zINSTREAM\0".length + 9).toString()).toBe("hello");
    expect(payload.subarray(-4).equals(Buffer.alloc(4))).toBe(true);
    expect(parseClamAvResponse("stream: Eicar-Test-Signature FOUND\0")).toEqual({
      status: "infected",
      signature: "Eicar-Test-Signature"
    });
    expect(parseClamAvResponse("stream: OK\0")).toEqual({ status: "clean" });
  });
});
