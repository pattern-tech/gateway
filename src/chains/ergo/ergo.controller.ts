import { Ergo } from './ergo';
import {
  AssetsResponse,
  BalanceRequest,
  PoolRequest,
  PoolResponse,
  transferRequest,
} from './ergo.requests';
import {
  ErgoUnsignedTransaction,
  OutputBuilder,
  TransactionBuilder,
} from '@fleet-sdk/core';

export class ErgoController {
  static async pool(ergo: Ergo, req: PoolRequest): Promise<PoolResponse> {
    if (!ergo.ready) {
      await ergo.init();
    }
    return ergo.getPool(req.poolId).getPoolInfo;
  }

  static async balances(chain: Ergo, request: BalanceRequest) {
    if (!chain.ready) {
      await chain.init();
    }
    const utxos = await chain.getAddressUnspentBoxes(request.address);
    const { balance, assets } = chain.getBalance(utxos);

    return {
      balance,
      assets,
    };
  }

  static async getTokens(ergo: Ergo): Promise<AssetsResponse> {
    if (!ergo.ready) {
      await ergo.init();
    }
    return {
      assets: ergo.storedAssetList,
    };
  }

  static async transfer(
    ergo: Ergo,
    req: transferRequest,
  ): Promise<ErgoUnsignedTransaction> {
    const networkHeight = await ergo.getNetworkHeight();
    const utxos = await ergo.getAddressUnspentBoxes(req.fromAddress);
    return new TransactionBuilder(networkHeight)
      .from(utxos)
      .to(new OutputBuilder(req.toValue, req.toAddress).addTokens(req.assets))
      .sendChangeTo(req.fromAddress)
      .payMinFee()
      .build();
  }
}
