import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InboxClient } from "@/components/inbox-client";

describe("InboxClient", () => {
  it("copies the generated mailbox address", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText }
    });

    render(
      <InboxClient
        initialMailbox={{
          id: "box-1",
          token: "token",
          address: "abc123@dropmail.test",
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
          status: "active"
        }}
        initialMessages={[]}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /copy address/i }));

    expect(writeText).toHaveBeenCalledWith("abc123@dropmail.test");
  });

  it("shows the empty inbox state before messages arrive", () => {
    render(
      <InboxClient
        initialMailbox={{
          id: "box-1",
          token: "token",
          address: "abc123@dropmail.test",
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
          status: "active"
        }}
        initialMessages={[]}
      />
    );

    expect(screen.getByText("Waiting for incoming mail")).toBeInTheDocument();
  });

  it("switches to expired state when mailbox is expired", async () => {
    render(
      <InboxClient
        initialMailbox={{
          id: "box-1",
          token: "token",
          address: "abc123@dropmail.test",
          expiresAt: new Date(Date.now() - 1_000).toISOString(),
          status: "expired"
        }}
        initialMessages={[]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Mailbox expired")).toBeInTheDocument();
    });
  });
});
