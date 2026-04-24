export const enum ProtocolMessageType {
  Regular = 1,
  Control = 2,
  Ack = 3,
  Disconnect = 5,
  ReplayRequest = 6,
  Pause = 7,
  Resume = 8,
  KeepAlive = 9
}

export const enum RPCMessageType {
  RequestJSONArgs = 1,
  RequestJSONArgsWithCancellation = 2,
  RequestMixedArgs = 3,
  RequestMixedArgsWithCancellation = 4,
  Acknowledged = 5,
  Cancel = 6,
  ReplyOKEmpty = 7,
  ReplyOKVSBuffer = 8,
  ReplyOKJSON = 9,
  ReplyOKJSONWithBuffers = 10,
  ReplyErrError = 11,
  ReplyErrEmpty = 12
}

export const HEADER_LENGTH = 13 // 1 + 4 + 4 + 4

export function encodeMessage(
  type: ProtocolMessageType,
  id: number,
  ack: number,
  data: Buffer
): Buffer {
  const header = Buffer.alloc(HEADER_LENGTH)
  header[0] = type
  header.writeUInt32BE(id, 1)
  header.writeUInt32BE(ack, 5)
  header.writeUInt32BE(data.length, 9)
  return Buffer.concat([header, data])
}

export function decodeMessage(buffer: Buffer): {
  type: ProtocolMessageType
  id: number
  ack: number
  data: Buffer
} | null {
  if (buffer.length < HEADER_LENGTH) return null
  const type = buffer[0] as ProtocolMessageType
  const id = buffer.readUInt32BE(1)
  const ack = buffer.readUInt32BE(5)
  const dataLength = buffer.readUInt32BE(9)
  if (buffer.length < HEADER_LENGTH + dataLength) return null
  const data = buffer.subarray(HEADER_LENGTH, HEADER_LENGTH + dataLength)
  return { type, id, ack, data }
}
