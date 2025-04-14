import { FastifyPluginAsync } from 'fastify';

import { Spectrum } from './spectrum';
import {
  PriceRequest,
  PriceResponse,
  TradeRequest,
  TradeResponse,
  PriceRequestSchema,
  PriceResponseSchema,
  TradeRequestSchema,
  TradeResponseSchema,
} from '../connector.requests';
import {
  validatePriceRequest,
  validateTradeRequest,
} from '../connector.validators';
import { StatusRequest } from '../../chains/chain.requests';
import { Type } from '@sinclair/typebox';
import { getInitializedChain } from '../../services/connection-manager';
import { Ergo } from '../../chains/ergo/ergo';
import { ErgoController } from '../../chains/ergo/ergo.controllers';

export const spectrumRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /ergo/status
  fastify.get<{ Querystring: StatusRequest }>(
    '/status',
    {
      schema: {
        tags: ['ergo'],
        description: 'Get Ergo chain status',
        querystring: Type.Object({
          network: Type.String(),
        }),
      },
    },
    async (request) => {
      const chain = Ergo.getInstance(
        request.query.network,
      );
      
      return await ErgoController.getStatus(chain as Ergo, request.query);
    },
  );

  // POST /spectrum/estimateTrade
  fastify.post<{ Body: PriceRequest; Reply: PriceResponse }>(
    '/price',
    {
      schema: {
        description: 'Get spectrum price quote',
        tags: ['spectrum'],
        body: PriceRequestSchema,
        response: {
          200: PriceResponseSchema,
        },
      },
    },
    async (request) => {
      validatePriceRequest(request.body);
      const connector: Spectrum = Spectrum.getInstance(
        request.body.chain,
        request.body.network,
      );
      return await connector.estimateTrade(request.body);
    },
  );

  // POST /spectrum/executeTrade
  fastify.post<{ Body: TradeRequest; Reply: TradeResponse }>(
    '/trade',
    {
      schema: {
        description: 'Execute spectrum trade',
        tags: ['spectrum'],
        body: TradeRequestSchema,
        response: {
          200: TradeResponseSchema,
        },
      },
    },
    async (request) => {
      validateTradeRequest(request.body);
      const connector: Spectrum = Spectrum.getInstance(
        request.body.chain,
        request.body.network,
      );
      return await connector.executeTrade(request.body);
    },
  );
};

export default spectrumRoutes;
