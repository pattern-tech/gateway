import Fastify, { FastifyInstance } from 'fastify';
import spectrumRoutes from '../../../src/connectors/spectrum/spectrum.routes';
import { Ergo } from '../../../src/chains/ergo/ergo';
import { ErgoController } from '../../../src/chains/ergo/ergo.controllers';
import * as validators from '../../../src/connectors/connector.validators';
import { Spectrum } from '../../../src/connectors/spectrum/spectrum';
import { ExecuteSwapRequestType, ExecuteSwapResponseType } from '../../../src/schemas/trading-types/swap-schema';

describe('spectrumRoutes', () => {
  let fastify: FastifyInstance;
  let ergo = new Ergo('mainnet');
  let spectrum = Spectrum.getInstance('ergo', 'mainnet');

  const mockStatus = { height: 1234, network: 'mainnet' };
  const mockChainInstance = ergo;

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
      jest.spyOn(Ergo, 'getInstance').mockReturnValue(mockChainInstance);
      jest
        .spyOn(ErgoController, 'getStatus')
        .mockResolvedValue(mockStatus as any);

      const response = await fastify.inject({
        method: 'GET',
        url: '/status',
        query: { network: 'mainnet' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(mockStatus);
      expect(Ergo.getInstance).toHaveBeenCalledWith('mainnet');
      expect(ErgoController.getStatus).toHaveBeenCalledWith(mockChainInstance, {
        network: 'mainnet',
      });
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
  });

  describe('POST /spectrum/price', () => {
    const mockPriceResponse = {
      price: '100.50',
      base: 'SIGUSD',
      quote: 'ERG',
      amount: '10',
      rawAmount: '5',
      expectedAmount: '9',
      network: 'mainnet',
      timestamp: 1234566,
      latency: 1,
      gasPrice: 10000000,
      gasPriceToken: 'ERG',
      gasLimit: 200000000,
      gasCost: '10000',
      gasWanted: '20000',
    };

    const mockPriceRequest = {
      chain: 'ergo',
      network: 'mainnet',
      connector: 'spectrum',
      quote: 'ERG',
      base: 'SIGUSD',
      amount: '10',
      side: 'BUY',
    };

    it('should return price quote for valid request', async () => {
      jest.spyOn(validators, 'validatePriceRequest').mockReturnValue;
      jest
        .spyOn(spectrum, 'estimateTrade')
        .mockResolvedValue(mockPriceResponse);

      const response = await fastify.inject({
        method: 'POST',
        url: '/price',
        payload: mockPriceRequest,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(mockPriceResponse);
      expect(spectrum.estimateTrade).toHaveBeenCalledWith(mockPriceRequest);
      expect(validators.validatePriceRequest).toHaveBeenCalledWith(
        mockPriceRequest,
      );
    });

    it('should return 400 for invalid price request', async () => {
      jest.spyOn(validators, 'validatePriceRequest').mockImplementation(() => {
        throw new Error('Invalid price request');
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/price',
        payload: { chain: 'ergo' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty('error');
    });
  });

  describe('POST /spectrum/trade', () => {
    it('should execute trade for valid request', async () => {
      const mockTradeRequest: ExecuteSwapRequestType = {
        network: 'mainnet',
        walletAddress: 'walletAddress123',
        quoteToken: 'SIGUSD',
        baseToken: 'ERG',
        side: 'BUY',
        slippagePct: 1,
        amount: 10,
      };
      const mockTradeResponse: ExecuteSwapResponseType = {
        "baseTokenBalanceChange": 10,
        "quoteTokenBalanceChange": 0.001,
        "fee": 2000,
        "signature": "txId",
        "totalInputSwapped": 10,
        "totalOutputSwapped": 0.001,
      };
      jest.spyOn(spectrum, 'executeTrade').mockResolvedValue(mockTradeResponse),

      jest.spyOn(validators, 'validateTradeRequest').mockReturnValue();

      const response = await fastify.inject({
        method: 'POST',
        url: '/execute-swap',
        payload: mockTradeRequest,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(mockTradeResponse);
      expect(spectrum.executeTrade).toHaveBeenCalledWith(
        mockTradeRequest,
      );
    });

    it('should return 400 for invalid trade request', async () => {
      jest.spyOn(validators, 'validateTradeRequest').mockImplementation(() => {
        throw new Error('Invalid trade request');
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/execute-swap',
        payload: { chain: 'ergo' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toHaveProperty('error');
    });
  });
});
