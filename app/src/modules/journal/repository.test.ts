import { describe, expect, it } from "vitest";
import {
  deleteJournalEintrag,
  updateJournalEintrag,
} from "./repository";
import { IMMUTABLE_ERROR } from "./invariants";

describe("repository Immutability-Guard", () => {
  it("updateJournalEintrag wirft immer", async () => {
    await expect(updateJournalEintrag()).rejects.toThrow(IMMUTABLE_ERROR);
  });

  it("deleteJournalEintrag wirft immer", async () => {
    await expect(deleteJournalEintrag()).rejects.toThrow(IMMUTABLE_ERROR);
  });
});
