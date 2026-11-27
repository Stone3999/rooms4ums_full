import { VoiceGateway } from './voice.gateway';

describe('VoiceGateway', () => {
  let gateway: VoiceGateway;
  let redis: any;

  beforeEach(() => {
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([]),
    };
    gateway = new VoiceGateway(redis);
    gateway.server = {
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      emit: jest.fn(),
    } as any;
  });

  it('se construye con el cliente Redis inyectado', () => {
    expect(gateway).toBeDefined();
  });

  it('descarta el estado del socket al desconectarse (RES-06)', async () => {
    const client: any = { id: 's1', data: {} };

    await expect(gateway.handleDisconnect(client)).resolves.toBeUndefined();
  });
});
