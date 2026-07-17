const HEADER_SCAN_BYTES = 256 * 1024;
const MAX_NORMALIZE_BYTES = 256 * 1024 * 1024;

function fourCC(view, offset) {
  if (offset + 4 > view.byteLength) return '';
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

export function inspectWav(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  if (view.byteLength < 12 || fourCC(view, 0) !== 'RIFF' || fourCC(view, 8) !== 'WAVE') return null;

  let format = null;
  let dataOffset = 0;
  let dataSize = 0;
  let offset = 12;

  while (offset + 8 <= view.byteLength) {
    const id = fourCC(view, offset);
    const size = view.getUint32(offset + 4, true);
    const payloadOffset = offset + 8;

    if (id === 'fmt ' && size >= 16 && payloadOffset + 16 <= view.byteLength) {
      format = {
        audioFormat: view.getUint16(payloadOffset, true),
        channels: view.getUint16(payloadOffset + 2, true),
        sampleRate: view.getUint32(payloadOffset + 4, true),
        blockAlign: view.getUint16(payloadOffset + 12, true),
        bitsPerSample: view.getUint16(payloadOffset + 14, true),
      };
    }

    if (id === 'data') {
      dataOffset = payloadOffset;
      dataSize = size;
      break;
    }

    const nextOffset = payloadOffset + size + (size % 2);
    if (nextOffset <= offset || nextOffset > view.byteLength) break;
    offset = nextOffset;
  }

  return format ? { ...format, dataOffset, dataSize } : null;
}

function writeFourCC(view, offset, value) {
  for (let index = 0; index < 4; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

function clampSample(value) {
  return Math.max(-32768, Math.min(32767, Math.round(value)));
}

function convertTo16BitWav(arrayBuffer, info) {
  const bytesPerSample = info.bitsPerSample / 8;
  const availableBytes = Math.max(0, arrayBuffer.byteLength - info.dataOffset);
  const sourceBytes = Math.min(info.dataSize || availableBytes, availableBytes);
  const sampleCount = Math.floor(sourceBytes / bytesPerSample);
  const dataSize = sampleCount * 2;
  const output = new ArrayBuffer(44 + dataSize);
  const input = new DataView(arrayBuffer);
  const view = new DataView(output);

  writeFourCC(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeFourCC(view, 8, 'WAVE');
  writeFourCC(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, info.channels, true);
  view.setUint32(24, info.sampleRate, true);
  view.setUint32(28, info.sampleRate * info.channels * 2, true);
  view.setUint16(32, info.channels * 2, true);
  view.setUint16(34, 16, true);
  writeFourCC(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const sourceOffset = info.dataOffset + index * bytesPerSample;
    let sample = 0;

    if (info.audioFormat === 1 && info.bitsPerSample === 24) {
      const raw = input.getUint8(sourceOffset)
        | (input.getUint8(sourceOffset + 1) << 8)
        | (input.getUint8(sourceOffset + 2) << 16);
      const signed = raw & 0x800000 ? raw - 0x1000000 : raw;
      sample = signed / 256;
    } else if (info.audioFormat === 1 && info.bitsPerSample === 32) {
      sample = input.getInt32(sourceOffset, true) / 65536;
    } else if (info.audioFormat === 3 && info.bitsPerSample === 32) {
      sample = Math.max(-1, Math.min(1, input.getFloat32(sourceOffset, true))) * 32767;
    } else if (info.audioFormat === 3 && info.bitsPerSample === 64) {
      sample = Math.max(-1, Math.min(1, input.getFloat64(sourceOffset, true))) * 32767;
    }

    view.setInt16(44 + index * 2, clampSample(sample), true);
  }

  return new Blob([output], { type: 'audio/wav' });
}

export async function prepareAudioFile(file) {
  const appearsToBeWav = /\.wav(e)?$/i.test(file.name || '') || /wav|wave/i.test(file.type || '');
  if (!appearsToBeWav || file.size > MAX_NORMALIZE_BYTES) {
    return { blob: file, normalized: false, sourceBits: null };
  }

  const header = await file.slice(0, Math.min(file.size, HEADER_SCAN_BYTES)).arrayBuffer();
  const info = inspectWav(header);
  const needsNormalization = info && (
    (info.audioFormat === 1 && (info.bitsPerSample === 24 || info.bitsPerSample === 32))
    || (info.audioFormat === 3 && (info.bitsPerSample === 32 || info.bitsPerSample === 64))
  );

  if (!needsNormalization) return { blob: file, normalized: false, sourceBits: info?.bitsPerSample ?? null };

  const source = await file.arrayBuffer();
  const completeInfo = inspectWav(source);
  if (!completeInfo?.dataOffset || !completeInfo.dataSize) {
    return { blob: file, normalized: false, sourceBits: info.bitsPerSample };
  }

  return {
    blob: convertTo16BitWav(source, completeInfo),
    normalized: true,
    sourceBits: completeInfo.bitsPerSample,
  };
}
