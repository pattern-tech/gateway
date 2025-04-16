import Fastify, { FastifyInstance } from 'fastify';
import spectrumRoutes from '../../../src/connectors/spectrum/spectrum.routes';
import { Ergo } from '../../../src/chains/ergo/ergo';
import { ErgoController } from '../../../src/chains/ergo/ergo.controllers';

describe('spectrumRoutes', () => {
  let fastify: FastifyInstance;
  let ergo = new Ergo('mainnet')
  let ergoController = new ErgoController()

  beforeEach(async () => {
    fastify = Fastify();
    await fastify.register(spectrumRoutes);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('GET /ergo/status', () => {
    it('should return chain status for valid network', async () => {
      const mockStatus = { height: 1234, network: 'mainnet' };
      const mockChainInstance = ergo;
      
      jest.spyOn(Ergo, 'getInstance').mockReturnValue(mockChainInstance);
      jest.spyOn(ErgoController, 'getStatus').mockResolvedValue(mockStatus as any);

      const response = await fastify.inject({
        method: 'GET',
        url: '/status',
        query: { network: 'mainnet' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(mockStatus);
      expect(Ergo.getInstance).toHaveBeenCalledWith('mainnet');
      expect(ErgoController.getStatus).toHaveBeenCalledWith(mockChainInstance, { network: 'mainnet' });
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(Ergo, 'getInstance').mockImplementation(() => {
        throw new Error('Chain initialization failed');
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/status',
        query: { network: 'mainnet' },
      });

      expect(response.statusCode).toBe(500);
      expect(response.json()).toHaveProperty('error');
    });
  // });

  // describe('POST /spectrum/price', () => {
  //   it('should return price quote for valid request', async () => {
  //     const mockPriceRequest = {
  //       chain: 'ergo',
  //       network: 'mainnet',
  //       tokenId: 'token123',
  //       amount: 100,
  //     };
  //     const mockPriceResponse = { estimatedPrice: 50, fee: 1 };
  //     const mockConnectorInstance = { estimateTrade: jest.fn().mockResolvedValue(mockPriceResponse) };

  //     (validatePriceRequest as jest.Mock).mockReturnValue();
  //     (Spectrum.getInstance as jest.Mock).mockReturnValue(mockConnectorInstance);

  //     const response = await fastify.inject({
  //       method: 'POST',
  //       url: '/spectrum/price',
  //       payload: mockPriceRequest,
  //     });

  //     expect(response.statusCode).toBe(200);
  //     expect(response.json()).toEqual(mockPriceResponse);
  //     expect(validatePriceRequest).toHaveBeenCalledWith(mockPriceRequest);
  //     expect(Spectrum.getInstance).toHaveBeenCalledWith('ergo', 'mainnet');
  //     expect(mockConnectorInstance.estimateTrade).toHaveBeenCalledWith(mockPriceRequest);
  //   });

  //   it('should return 400 for invalid price request', async () => {
  //     (validatePriceRequest as jest.Mock).mockImplementation(() => {
  //       throw new Error('Invalid price request');
  //     });

  //     const response = await fastify.inject({
  //       method: 'POST',
  //       url: '/spectrum/price',
  //       payload: { chain: 'ergo' },
  //     });

  //     expect(response.statusCode).toBe(400);
  //     expect(response.json()).toHaveProperty('error');
  //   });
  // });

  // describe('POST /spectrum/trade', () => {
  //   it('should execute trade for valid request', async () => {
  //     const mockTradeRequest = {
  //       chain: 'ergo',
  //       network: 'mainnet',
  //       tokenId: 'token123',
  //       amount: 100,
  //       address: 'address123',
  //     };
  //     const mockTradeResponse = { txId: 'tx123', status: 'pending' };
  //     const mockConnectorInstance = { executeTrade: jest.fn().mockResolvedValue(mockTradeResponse) };

  //     (validateTradeRequest as jest.Mock).mockReturnValue();
  //     (Spectrum.getInstance as jest.Mock).mockReturnValue(mockConnectorInstance);

  //     const response = await fastify.inject({
  //       method: 'POST',
  //       url: '/spectrum/trade',
  //       payload: mockTradeRequest,
  //     });

  //     expect(response.statusCode).toBe(200);
  //     expect(response.json()).toEqual(mockTradeResponse);
  //     expect(validateTradeRequest).toHaveBeenCalledWith(mockTradeRequest);
  //     expect(Spectrum.getInstance).toHaveBeenCalledWith('ergo', 'mainnet');
  //     expect(mockConnectorInstance.executeTrade).toHaveBeenCalledWith(mockTradeRequest);
  //   });

  //   it('should return 400 for invalid trade request', async () => {
  //     (validateTradeRequest as jest.Mock).mockImplementation(() => {
  //       throw new Error('Invalid trade request');
  //     });

  //     const response = await fastify.inject({
  //       method: 'POST',
  //       url: '/spectrum/trade',
  //       payload: { chain: 'ergo' },
  //     });

  //     expect(response.statusCode).toBe(400);
  //     expect(response.json()).toHaveProperty('error');
  //   });
  });
});