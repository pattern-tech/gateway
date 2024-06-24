import {
  NetworkPrefix,
  SecretKey,
  SecretKeys,
  Wallet,
  ErgoBoxes,
  UnsignedTransaction,
} from 'ergo-lib-wasm-nodejs';
import LRUCache from 'lru-cache';
import { ErgoController } from './ergo.controller';
import { NodeService } from './node.service';
import { getErgoConfig } from './ergo.config';
import { DexService } from './dex.service';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import {
  ErgoAccount,
  ErgoAsset,
  ErgoBox,
  ErgoConnectedInstance,
} from './interfaces/ergo.interface';
import {
  AmmPool,
  makeNativePools,
  makeWrappedNativePoolActionsSelector,
  minValueForOrder,
  minValueForSetup,
  SwapExtremums,
  SwapParams,
  swapVars,
} from '@patternglobal/ergo-dex-sdk';
import {
  Explorer,
  Prover,
  ErgoTx,
  UnsignedErgoTx,
  unsignedErgoTxToProxy,
  DefaultTxAssembler,
  AssetAmount,
  MinBoxValue,
  DefaultBoxSelector,
  InsufficientInputs,
  publicKeyFromAddress,
  TransactionContext,
  Address,
  BoxSelection,
  Input as TxInput,
  RustModule,
} from '@patternglobal/ergo-sdk';
import { makeTarget } from '@patternglobal/ergo-dex-sdk/build/main/utils/makeTarget';
import { NativeExFeeType } from '@patternglobal/ergo-dex-sdk/build/main/types';
import { NetworkContext } from '@patternglobal/ergo-sdk/build/main/entities/networkContext';
async function x() {
  await RustModule.load(true);
}
x();
class Pool extends AmmPool {
  private name: string;

  constructor(public pool: AmmPool) {
    super(pool.id, pool.lp, pool.x, pool.y, pool.poolFeeNum);

    this.name = `${this.x.asset.name}/${this.y.asset.name}`;
  }

  public getName() {
    return this.name;
  }

  // calculatePriceImpact(input: any): number {
  //   const ratio =
  //     input.asset.id === this.x.asset.id
  //       ? math.evaluate!(
  //         `${renderFractions(this.y.amount.valueOf(), this.y.asset.decimals)} / ${renderFractions(this.x.amount.valueOf(), this.x.asset.decimals)}`,
  //       ).toString()
  //       : math.evaluate!(
  //         `${renderFractions(this.x.amount.valueOf(), this.x.asset.decimals)} / ${renderFractions(this.y.amount.valueOf(), this.y.asset.decimals)}`,
  //       ).toString();
  //   const outputAmount = calculatePureOutputAmount(input, this);
  //   const outputRatio = math.evaluate!(
  //     `${outputAmount} / ${renderFractions(input.amount, input.asset.decimals)}`,
  //   ).toString();
  //
  //   return Math.abs(
  //     math.evaluate!(`(${outputRatio} * 100 / ${ratio}) - 100`).toFixed(2),
  //   );
  // }
}

export type BaseInputParameters = {
  baseInput: AssetAmount;
  baseInputAmount: bigint;
  minOutput: AssetAmount;
};
export const getBaseInputParameters = (
  pool: AmmPool,
  { inputAmount, slippage }: { inputAmount: any; slippage: number },
): BaseInputParameters => {
  const baseInputAmount =
    inputAmount.asset.id === pool.x.asset.id
      ? pool.x.withAmount(inputAmount.amount)
      : pool.y.withAmount(inputAmount.amount);
  const minOutput = pool.outputAmount(baseInputAmount as any, slippage);

  return {
    baseInput: baseInputAmount as any,
    baseInputAmount: inputAmount.amount,
    minOutput: minOutput as any,
  };
};
export const getInputs = (
  utxos: ErgoBox[],
  assets: AssetAmount[],
  fees: { minerFee: bigint; uiFee: bigint; exFee: bigint },
  minBoxValue: bigint,
  ignoreMinBoxValue?: boolean,
  setup?: boolean,
): BoxSelection => {
  let minFeeForOrder = minValueForOrder(fees.minerFee, fees.uiFee, fees.exFee);
  if (setup) {
    minFeeForOrder = minValueForSetup(fees.minerFee, fees.uiFee);
  }
  if (ignoreMinBoxValue) {
    minFeeForOrder -= MinBoxValue;
  }

  const target = makeTarget(assets, minFeeForOrder);

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  const inputs = DefaultBoxSelector.select(utxos, target, minBoxValue);

  if (inputs instanceof InsufficientInputs) {
    throw new Error(
      `Error in getInputs function: InsufficientInputs -> ${inputs}`,
    );
  }

  return inputs;
};
export const getTxContext = (
  inputs: BoxSelection,
  network: NetworkContext,
  address: Address,
  minerFee: bigint,
): TransactionContext => ({
  inputs,
  selfAddress: address,
  changeAddress: address,
  feeNErgs: minerFee,
  network,
});

export class WalletProver implements Prover {
  readonly wallet: Wallet;
  readonly nodeService: NodeService;

  constructor(wallet: Wallet, nodeService: NodeService) {
    this.wallet = wallet;
    this.nodeService = nodeService;
  }

  /** Sign the given transaction.
   */
  async sign(tx: UnsignedErgoTx): Promise<ErgoTx> {
    const ctx = await this.nodeService.getCtx();
    const proxy = unsignedErgoTxToProxy(tx);
    const wasmtx = UnsignedTransaction.from_json(JSON.stringify(proxy));
    try {
      return this.wallet
        .sign_transaction(
          ctx,
          wasmtx,
          ErgoBoxes.from_boxes_json(proxy.inputs),
          ErgoBoxes.empty(),
        )
        .to_js_eip12();
    } catch {
      throw new Error('not be able to sign!');
    }
  }

  async submit(tx: ErgoTx): Promise<ErgoTx> {
    const txId = await this.nodeService.postTransaction(tx);
    return {
      ...tx,
      id: txId,
    };
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  signInput(tx: UnsignedErgoTx, input: number): Promise<TxInput> {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    return;
  }
}

export class Ergo {
  private _assetMap: Record<string, ErgoAsset> = {};
  private static _instances: LRUCache<string, Ergo>;
  private _chain: string = 'ergo';
  private _network: string;
  private _networkPrefix: NetworkPrefix;
  private _node: NodeService;
  private _explorer: Explorer;
  private _dex: DexService;
  private _ready: boolean = false;
  public txFee: number;
  public controller: ErgoController;
  private utxosLimit: number;
  private poolLimit: number;
  private ammPools: Array<Pool> = [];

  constructor(network: string) {
    const config = getErgoConfig(network);

    if (network === 'Mainnet') {
      this._networkPrefix = NetworkPrefix.Mainnet;
    } else {
      this._networkPrefix = NetworkPrefix.Testnet;
    }

    this._network = network;
    this._node = new NodeService(
      config.network.nodeURL,
      config.network.timeOut,
    );
    this._explorer = new Explorer(config.network.explorerURL);
    this._dex = new DexService(
      config.network.explorerDEXURL,
      config.network.timeOut,
    );
    this.controller = ErgoController;
    this.txFee = config.network.minTxFee;
    this.utxosLimit = config.network.utxosLimit;
    this.poolLimit = config.network.poolLimit;
  }

  public get node(): NodeService {
    return this._node;
  }

  public get network(): string {
    return this._network;
  }

  public get storedAssetList(): Array<ErgoAsset> {
    return Object.values(this._assetMap);
  }

  public get ready(): boolean {
    return this._ready;
  }

  /**
   * This function initializes the Ergo class' instance
   * @returns
   * @function
   * @async
   */
  public async init(): Promise<void> {
    await this.loadAssets();
    await this.loadPools();
    this._ready = true;
    return;
  }

  async close() {
    return;
  }

  /**
   * This static function returns the exists or create new Ergo class' instance based on the network
   * @param {string} network - mainnet or testnet
   * @returns Ergo
   * @function
   * @static
   */
  public static getInstance(network: string): Ergo {
    const config = getErgoConfig(network);

    if (!Ergo._instances) {
      Ergo._instances = new LRUCache<string, Ergo>({
        max: config.network.maxLRUCacheInstances,
      });
    }

    if (!Ergo._instances.has(config.network.name)) {
      if (network) {
        Ergo._instances.set(config.network.name, new Ergo(network));
      } else {
        throw new Error(
          `Ergo.getInstance received an unexpected network: ${network}.`,
        );
      }
    }

    return Ergo._instances.get(config.network.name) as Ergo;
  }

  /**
   * This static function returns the connected instances
   * @returns ErgoConnectedInstance
   * @function
   * @static
   */
  public static getConnectedInstances(): ErgoConnectedInstance {
    const connectedInstances: ErgoConnectedInstance = {};

    if (this._instances) {
      const keys = Array.from(this._instances.keys());

      for (const instance of keys) {
        if (instance) {
          connectedInstances[instance] = this._instances.get(instance) as Ergo;
        }
      }
    }

    return connectedInstances;
  }

  /**
   * This function returns the current network height(Block number)
   * @returns number
   * @function
   * @async
   */
  async getCurrentBlockNumber(): Promise<number> {
    const status = await this._node.getNetworkHeight();
    return status + 1;
  }

  /**
   * This function returns the unspent boxes based on the address from node
   * @returns ErgoBox[]
   * @function
   * @async
   */
  async getAddressUnspentBoxes(address: string) {
    let utxos: Array<ErgoBox> = [];
    let offset = 0;
    let nodeBoxes = await this._node.getUnspentBoxesByAddress(
      address,
      offset,
      this.utxosLimit,
    );

    while (nodeBoxes.length > 0) {
      utxos = [...utxos, ...nodeBoxes];
      offset += this.utxosLimit;
      nodeBoxes = await this._node.getUnspentBoxesByAddress(
        address,
        offset,
        this.utxosLimit,
      );
    }

    return utxos;
  }

  /**
   * Retrieves Ergo Account from secret key
   * @param {string} secret - Secret key
   * @returns ErgoAccount
   * @function
   */
  public getAccountFromSecretKey(secret: string): ErgoAccount {
    const sks = new SecretKeys();
    const secretKey = SecretKey.dlog_from_bytes(Buffer.from(secret, 'hex'));
    const address = secretKey.get_address().to_base58(this._networkPrefix);

    sks.add(secretKey);

    const wallet = Wallet.from_secrets(sks);

    return {
      address,
      wallet,
      prover: new WalletProver(wallet, this._node),
    };
  }

  /**
   * Encrypt secret via password
   * @param {string} secret - Secret key
   * @param {string} password - password
   * @returns string
   * @function
   */
  public encrypt(secret: string, password: string): string {
    const iv = randomBytes(16);
    const key = Buffer.alloc(32);

    key.write(password);

    const cipher = createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(secret), cipher.final()]);

    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypt encrypted secret key via password
   * @param {string} encryptedSecret - Secret key
   * @param {string} password - password
   * @returns string
   * @function
   */
  public decrypt(encryptedSecret: string, password: string): string {
    const [iv, encryptedKey] = encryptedSecret.split(':');
    const key = Buffer.alloc(32);

    key.write(password);

    const decipher = createDecipheriv(
      'aes-256-cbc',
      key,
      Buffer.from(iv, 'hex'),
    );
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedKey, 'hex')),
      decipher.final(),
    ]);

    return decrypted.toString();
  }

  /**
   *  Gets asset balance from unspent boxes
   * @param {ErgoAccount} account
   * @param {string} assetName
   * @returns string
   * @function
   * @async
   */
  public async getAssetBalance(
    account: ErgoAccount,
    assetName: string,
  ): Promise<string> {
    const ergoAsset = this._assetMap[assetName.toUpperCase()];
    let balance = 0;
    if (!ergoAsset) throw new Error(`assetName not found ${this._chain} Node!`);
    try {
      const utxos = await this.getAddressUnspentBoxes(account.address);
      balance = utxos.reduce(
        (total: number, box) =>
          total +
          box.assets
            .filter((asset) => asset.tokenId === ergoAsset.tokenId.toString())
            .reduce(
              (total_asset, asset) => total_asset + Number(asset.amount),
              0,
            ),
        0,
      );
    } catch (error: any) {
      throw new Error(
        `problem during finding account assets ${this._chain} Node!`,
      );
    }

    return balance.toString();
  }

  private async loadAssets() {
    const assetData = await this.getAssetData();

    for (const result of assetData.tokens) {
      this._assetMap[result.name.toUpperCase()] = {
        tokenId: result.address,
        decimals: result.decimals,
        name: result.name,
        symbol: result.ticker,
      };
    }
  }

  private async getAssetData() {
    return await this._dex.getTokens();
  }

  private async loadPools(): Promise<void> {
    let offset = 0;
    let pools: Array<Pool> = await this.getPoolData(this.poolLimit, offset);
    while (pools.length > 0) {
      for (const pool of pools) {
        if (!this.ammPools.filter((ammPool) => ammPool.id === pool.id).length) {
          this.ammPools.push(pool);
        }
      }

      offset += this.poolLimit;
      pools = await this.getPoolData(this.poolLimit, offset);
    }
  }

  private async getPoolData(limit: number, offset: number): Promise<any> {
    const [AmmPool] = await makeNativePools(this._explorer).getAll({
      limit,
      offset,
    });
    return AmmPool;
  }

  /**
   *  Returns a map of asset name and Ergo Asset
   * @returns assetMap
   */
  public get storedTokenList() {
    return this._assetMap;
  }
  private async swap(
    account: ErgoAccount,
    pool: Pool,
    x_amount: bigint,
    y_amount: bigint,
    output_address: string,
    return_address: string,
    slippage: number,
    sell: boolean,
  ): Promise<ErgoTx> {
    const config = getErgoConfig(this.network);
    const networkContext = await this._explorer.getNetworkContext();
    const mainnetTxAssembler = new DefaultTxAssembler(
      this.network === 'Mainnet',
    );
    const poolActions = makeWrappedNativePoolActionsSelector(
      output_address,
      account.prover,
      mainnetTxAssembler,
    );
    const utxos = await this.getAddressUnspentBoxes(account.address);
    const to = {
      asset: {
        id: sell ? pool.x.asset.id : pool.y.asset.id,
        decimals: sell ? pool.x.asset.decimals : pool.y.asset.decimals,
      },
      amount: sell ? x_amount : y_amount,
    };
    const max_to = {
      asset: {
        id: sell ? pool.x.asset.id : pool.y.asset.id,
      },
      amount: sell ? x_amount : y_amount,
    };
    const from = {
      asset: {
        id: sell ? pool.y.asset.id : pool.x.asset.id,
        decimals: sell ? pool.y.asset.decimals : pool.x.asset.decimals,
      },
      amount: pool.outputAmount(
        max_to as any,
        slippage || config.network.defaultSlippage,
      ).amount,
    };
    const { baseInput, baseInputAmount, minOutput } = getBaseInputParameters(
      pool,
      {
        inputAmount: from,
        slippage: slippage || config.network.defaultSlippage,
      },
    );
    const swapVariables: [number, SwapExtremums] | undefined = swapVars(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      config.network.defaultMinerFee * 3n,
      config.network.minNitro,
      minOutput,
    );
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const [exFeePerToken, extremum] = swapVariables;
    const inputs = getInputs(
      utxos.map((utxo) => {
        const temp = Object(utxo);
        temp.value = BigInt(temp.value);
        temp.assets = temp.assets.map((asset: any) => {
          const temp2 = Object(asset);
          temp2.amount = BigInt(temp2.amount);
          return temp2;
        });
        return temp;
      }),
      [new AssetAmount(from.asset, baseInputAmount)],
      {
        minerFee: config.network.defaultMinerFee,
        uiFee: BigInt(sell ? y_amount : x_amount),
        exFee: extremum.maxExFee,
      },
      config.network.minBoxValue,
    );
    const swapParams: SwapParams<NativeExFeeType> = {
      poolId: pool.id,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      pk: publicKeyFromAddress(output_address),
      baseInput,
      minQuoteOutput: extremum.minOutput.amount,
      exFeePerToken,
      uiFee: BigInt(sell ? y_amount : x_amount),
      quoteAsset: to.asset.id,
      poolFeeNum: pool.poolFeeNum,
      maxExFee: extremum.maxExFee,
    };
    const txContext: TransactionContext = getTxContext(
      inputs,
      networkContext as NetworkContext,
      return_address,
      config.network.defaultMinerFee,
    );

    const actions = poolActions(pool);
    return await actions.swap(swapParams, txContext);
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  private async buy(
    account: ErgoAccount,
    pool: Pool,
    x_amount: bigint,
    y_amount: bigint,
    output_address: string,
    return_address: string,
    slippage: number,
  ): Promise<ErgoTx> {
    return await this.swap(
      account,
      pool,
      x_amount,
      y_amount,
      output_address,
      return_address,
      slippage,
      false,
    );
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  private async sell(
    account: ErgoAccount,
    pool: Pool,
    x_amount: bigint,
    y_amount: bigint,
    output_address: string,
    return_address: string,
    slippage: number,
  ): Promise<ErgoTx> {
    return await this.swap(
      account,
      pool,
      x_amount,
      y_amount,
      output_address,
      return_address,
      slippage,
      true,
    );
  }
  private async estimate(
    pool: Pool,
    amount: bigint,
    slippage: number,
    sell: boolean,
  ): Promise<AssetAmount> {
    const config = getErgoConfig(this.network);
    const max_to = {
      asset: {
        id: sell ? pool.x.asset.id : pool.y.asset.id,
      },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      amount,
    };
    const from = {
      asset: {
        id: sell ? pool.y.asset.id : pool.x.asset.id,
        decimals: sell ? pool.y.asset.decimals : pool.x.asset.decimals,
      },
      amount: pool.outputAmount(
        max_to as any,
        slippage || config.network.defaultSlippage,
      ).amount,
    };
    const { minOutput } = getBaseInputParameters(pool, {
      inputAmount: from,
      slippage: slippage || config.network.defaultSlippage,
    });
    return minOutput;
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  private async estimateBuy(
    pool: Pool,
    y_amount: bigint,
    slippage: number,
  ): Promise<AssetAmount> {
    return await this.estimate(pool, y_amount, slippage, false);
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  private async estimateSell(
    pool: Pool,
    x_amount: bigint,
    slippage: number,
  ): Promise<AssetAmount> {
    return await this.estimate(pool, x_amount, slippage, true);
  }
  public getPool(id: string): Pool {
    return <Pool>this.ammPools.find((ammPool) => ammPool.id === id);
  }
}
