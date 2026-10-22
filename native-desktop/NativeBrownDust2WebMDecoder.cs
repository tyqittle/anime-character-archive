// SPDX-License-Identifier: GPL-3.0-or-later
// Minimal bounded EBML WebM audio-only demux + managed Opus decoder.
// The original voice is NOT redistributed. Convert it in the user's own
// data directory to PCM WAV so Windows 10 does not need external WebM codecs.
using System.IO;
using System.Text;
using Concentus;

namespace SpinePet;

internal static class NativeBrownDust2WebMDecoder
{
    private const int MaxCompressedBytes = 3_000_000;
    private const int MaxDecodedBytes = 48_000_000;
    private const int SampleRate = 48_000;

    public static byte[] DecodeToWave(byte[] webm)
    {
        if (webm.Length < 50 || webm.Length > MaxCompressedBytes ||
            webm[0] != 0x1A || webm[1] != 0x45 ||
            webm[2] != 0xDF || webm[3] != 0xA3)
            throw new InvalidDataException("Not a bounded WebM file");
        List<(int Start,int Count)> packets = [];
        int channels = 0, preSkip = 0;
        Traverse(webm, 0, webm.Length, packets, ref channels, ref preSkip, 0);
        if (channels is < 1 or > 2 || packets.Count == 0)
            throw new InvalidDataException("Missing Opus track or audio packets");

        IOpusDecoder decoder = OpusCodecFactory.CreateDecoder(SampleRate, channels);
        using MemoryStream pcm = new();
        using (BinaryWriter writer = new(pcm, Encoding.UTF8, leaveOpen: true))
        {
            short[] buffer = new short[5760 * channels];
            foreach ((int start, int length) in packets)
            {
                int frames = decoder.Decode(
                    webm.AsSpan(start, length), buffer.AsSpan(), 5760, false);
                if (frames <= 0 || frames > 5760)
                    throw new InvalidDataException("Opus decoder returned invalid length");
                int skip = Math.Min(frames, preSkip);
                preSkip -= skip;
                for (int i = skip * channels; i < frames * channels; i++)
                    writer.Write(buffer[i]);
                if (pcm.Length > MaxDecodedBytes)
                    throw new InvalidDataException("Opus WAV exceeds safety limit");
            }
        }
        if (pcm.Length < 100)
            throw new InvalidDataException("Decoded voice contains no PCM samples");
        using MemoryStream wav = new();
        using (BinaryWriter w = new(wav, Encoding.ASCII, leaveOpen: true))
        {
            int count = checked((int)pcm.Length);
            w.Write(Encoding.ASCII.GetBytes("RIFF")); w.Write(36 + count);
            w.Write(Encoding.ASCII.GetBytes("WAVEfmt "));
            w.Write(16); w.Write((short)1); w.Write((short)channels);
            w.Write(SampleRate); w.Write(SampleRate * channels * 2);
            w.Write((short)(channels * 2)); w.Write((short)16);
            w.Write(Encoding.ASCII.GetBytes("data")); w.Write(count);
            pcm.Position = 0;
            pcm.CopyTo(wav);
        }
        return wav.ToArray();
    }

    private static void Traverse(byte[] b, int begin, int end,
        List<(int Start, int Count)> packets,
        ref int channels, ref int preSkip, int depth)
    {
        if (depth > 8) throw new InvalidDataException("WebM nesting too deep");
        int p = begin;
        while (p < end)
        {
            if (!ReadVar(b, ref p, end, true, out ulong id) ||
                !ReadVar(b, ref p, end, false, out ulong len))
                throw new InvalidDataException("Malformed WebM element");
            // Unknown element sizes are permitted for streaming Segment.
            if (len == ulong.MaxValue) len = (ulong)(end - p);
            if (len > (ulong)(end - p))
                throw new InvalidDataException("WebM element crosses boundary");
            int next = checked(p + (int)len);
            if (id is 0x1A45DFA3 or 0x18538067 or 0x1549A966 or
                0x1654AE6B or 0xAE or 0x1F43B675 or 0xA0)
            {
                Traverse(b, p, next, packets, ref channels, ref preSkip, depth + 1);
            }
            else if (id == 0x63A2 && len >= 19 &&
                     Encoding.ASCII.GetString(b, p, 8) == "OpusHead")
            {
                channels = b[p + 9];
                preSkip = b[p + 10] | (b[p + 11] << 8);
            }
            else if (id is 0xA3 or 0xA1)
            {
                int pos = p;
                if (!ReadVar(b, ref pos, next, false, out ulong track) ||
                    next - pos < 4)
                    throw new InvalidDataException("Invalid WebM audio block");
                pos += 2; // signed cluster-relative timestamp
                byte flags = b[pos++];
                if ((flags & 0x06) != 0)
                    throw new InvalidDataException("Unsupported laced WebM Opus packets");
                if (track == 1 && next > pos)
                {
                    packets.Add((pos, next - pos));
                    if (packets.Count > 4096)
                        throw new InvalidDataException("Too many WebM audio packets");
                }
            }
            p = next;
        }
    }

    private static bool ReadVar(byte[] data, ref int pos, int end,
        bool isElementId, out ulong value)
    {
        value = 0;
        if (pos >= end || data[pos] == 0) return false;
        int size = 1, marker = 0x80;
        while (size <= 8 && (data[pos] & marker) == 0) { size++; marker >>= 1; }
        if (size > 8 || pos + size > end) return false;
        value = isElementId ? data[pos++] : (ulong)(data[pos++] & (marker - 1));
        for (int i = 1; i < size; i++) value = (value << 8) | data[pos++];
        if (!isElementId && value == ((1UL << (size * 7)) - 1UL))
            value = ulong.MaxValue;
        return true;
    }
}
