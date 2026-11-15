import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import CloudAssistant from "../../app/screens/CloudAssistant";
const request = vi.hoisted(() => vi.fn());
vi.mock("../../app/services/account/backendClient", async original => ({ ...await original<object>(), backendRequest: request }));
const messageId = "0123456789abcdef01234567", conversationId = "0123456789abcdef01234568";
const citation = { kind: "quran", reference: "Quran 2:153", href: "https://quranenc.com/en/home/api", external: true, excerpt: "Controlled source fixture", edition: "Controlled edition", attribution: "Controlled attribution" };
beforeEach(() => { request.mockReset(); });
const send = () => { fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Explain patience" } }); fireEvent.submit(screen.getByLabelText("Your question").closest("form")!); };
it("leaves history disabled, labels generated text and displays server-owned citation metadata", async () => {
  request.mockResolvedValue({ data: { mode: "generated", text: "Controlled answer", citations: [citation] } });
  render(<CloudAssistant onSourceSearch={() => {}} />); send();
  await screen.findByText("AI-generated explanation");
  expect(request).toHaveBeenCalledWith("/api/ai/chat", expect.objectContaining({ body: expect.objectContaining({ historyEnabled: false }) }));
  expect(screen.getByText("Quran 2:153").closest("a")).toHaveAttribute("href", citation.href);
  expect(screen.getByText(/Controlled edition/)).toHaveTextContent("Controlled attribution");
  expect(screen.queryByText("Report answer")).toBeNull();
});
it("saves only after opt-in, continues the saved conversation and reports its own message", async () => {
  request.mockImplementation(async path => path === "/api/ai/chat" ? { data: { mode: "generated", text: "Controlled answer", citations: [citation], messageId: request.mock.calls.filter(([p]) => p === "/api/ai/chat").length === 1 ? messageId : "0123456789abcdef01234569", conversationId } } : path.includes("conversations?") ? { data: [{ id: conversationId, title: "Patience" }], meta: { nextCursor: null } } : { data: { id: "report" } });
  render(<CloudAssistant onSourceSearch={() => {}} />); fireEvent.click(screen.getByLabelText("Save this conversation to my account")); send();
  await screen.findByText("Controlled answer"); await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeDisabled());
  expect(request).toHaveBeenCalledWith("/api/ai/chat", expect.objectContaining({ body: expect.objectContaining({ historyEnabled: true }) }));
  fireEvent.click(screen.getByText("Report answer")); fireEvent.change(screen.getByLabelText("Reason for reporting"), { target: { value: "Please review this explanation." } }); fireEvent.submit(screen.getByLabelText("Reason for reporting").closest("form")!);
  await screen.findByText("Report submitted.");
  expect(request).toHaveBeenCalledWith("/api/content-reports", expect.objectContaining({ body: { targetType: "ai-message", targetId: messageId, reason: "Please review this explanation." } }));
  await act(async () => send()); await waitFor(() => expect(request.mock.calls.filter(([path]) => path === "/api/ai/chat")).toHaveLength(2));
  expect(request.mock.calls.filter(([path]) => path === "/api/ai/chat").at(-1)?.[1].body.conversationId).toBe(conversationId);
});
it("shows an explicit evidence limit and handles provider failure without inventing text", async () => {
  request.mockResolvedValueOnce({ data: { mode: "limited", text: "Not enough verified evidence.", citations: [] } }).mockRejectedValueOnce(new Error("Generated answers are temporarily unavailable."));
  render(<CloudAssistant onSourceSearch={() => {}} />); send(); await screen.findByText("Insufficient reviewed evidence");
  expect(screen.queryByText("AI-generated explanation")).toBeNull();
  send(); expect(await screen.findByRole("alert")).toHaveTextContent("temporarily unavailable");
});
