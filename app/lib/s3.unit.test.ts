import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock, GetObjectCommandMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  GetObjectCommandMock: vi.fn(function (this: { input: unknown }, input: unknown) {
    this.input = input;
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn(function () {
    return { send: sendMock };
  }),
  GetObjectCommand: GetObjectCommandMock,
}));

import { isS3Configured, readS3Object, s3ObjectKey } from "./s3";

const ENV_KEYS = ["S3_BUCKET", "S3_PREFIX", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const;

beforeEach(() => {
  vi.stubEnv("S3_BUCKET", "dahlia");
  vi.stubEnv("S3_PREFIX", "files");
  vi.stubEnv("S3_ACCESS_KEY_ID", "access");
  vi.stubEnv("S3_SECRET_ACCESS_KEY", "secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  sendMock.mockReset();
  GetObjectCommandMock.mockClear();
});

describe("s3", () => {
  describe("isS3Configured", () => {
    it("is true when bucket and credentials are set", () => {
      expect(isS3Configured()).toBe(true);
    });

    it.each(ENV_KEYS.filter((key) => key !== "S3_PREFIX"))("is false when %s is missing", (key) => {
      vi.stubEnv(key, "");
      expect(isS3Configured()).toBe(false);
    });
  });

  describe("s3ObjectKey", () => {
    it("prepends the prefix without duplicate slashes", () => {
      vi.stubEnv("S3_PREFIX", "/files/");
      expect(s3ObjectKey("/mocked_pdfs/a.pdf")).toBe("files/mocked_pdfs/a.pdf");
    });

    it("returns the key as is without prefix", () => {
      vi.stubEnv("S3_PREFIX", "");
      expect(s3ObjectKey("mocked_pdfs/a.pdf")).toBe("mocked_pdfs/a.pdf");
    });
  });

  describe("readS3Object", () => {
    it("fetches the prefixed key from the bucket and returns a Buffer", async () => {
      sendMock.mockResolvedValue({
        Body: { transformToByteArray: async () => new Uint8Array([37, 80, 68, 70]) },
      });

      const data = await readS3Object("mocked_pdfs/a.pdf");

      expect(GetObjectCommandMock).toHaveBeenCalledWith({
        Bucket: "dahlia",
        Key: "files/mocked_pdfs/a.pdf",
      });
      expect(Buffer.isBuffer(data)).toBe(true);
      expect(data.toString()).toBe("%PDF");
    });

    it("throws when the object has no body", async () => {
      sendMock.mockResolvedValue({});
      await expect(readS3Object("missing.pdf")).rejects.toThrow('"files/missing.pdf"');
    });
  });
});
