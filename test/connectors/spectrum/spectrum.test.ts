import BigNumber from 'bignumber.js';
import { Ergo } from '../../../src/chains/ergo/ergo';
import { PriceRequest } from '../../../src/connectors/connector.requests';
import { Spectrum } from '../../../src/connectors/spectrum/spectrum';

const ergo = Ergo.getInstance('mainnet');

describe('Spectrum', () => {
  it('Should be defined', () => {
    expect(Spectrum).toBeDefined();
  });
  // beforeEach(() => {
  //   jest.spyOn(Ergo, 'getInstance').mockReturnValue({} as any);
  // });

  describe('getInstance', () => {
    it('Should be defined', () => {
      let spectrum = Spectrum.getInstance('ergo', 'mainnet');
      expect(spectrum).toBeDefined();
    });
    it('Should be an instance of Spectrum', () => {
      let spectrum = Spectrum.getInstance('ergo', 'mainnet');
      expect(spectrum).toBeInstanceOf(Spectrum);
    });
    it('Should create a new instance of Spectrum if there is no instance', () => {
      jest.spyOn(Ergo, 'getInstance').mockReturnValue({} as any);
      const newSpectrum = Spectrum.getInstance('ergo', 'testnet');
      expect(newSpectrum).toBeInstanceOf(Spectrum);
      expect(Ergo.getInstance).toHaveBeenCalledWith('testnet');
    });
    it('Should get the existing instance of Spectrum if it exists', () => {
      let spectrum = Spectrum.getInstance('ergo', 'testnet');
      const existingSpectrum = Spectrum.getInstance('ergo', 'testnet');
      expect(existingSpectrum).toBe(spectrum);
    });
  });

  describe('getTokenByAddress', () => {
    it('Should be defined', () => {
      const spectrum = Spectrum.getInstance('ergo', 'mainnet');
      expect(spectrum.getTokenByAddress).toBeDefined();
    });
    it('Should return undefined if the token is not found', () => {
      const spectrum = Spectrum.getInstance('ergo', 'mainnet');
      const token = spectrum.getTokenByAddress('invalid_address');
      expect(token).toBeUndefined();
    });
    it('Should return the token by address', () => {
      const spectrum = Spectrum.getInstance('ergo', 'mainnet');
      const tokenData = {
        name: 'Test Token',
        ticker: 'TT',
        decimals: 2,
        address: 'address',
        type: 'native',
        network: 'mainnet',
      } as any;
      spectrum['tokenList']['0x90874'] = tokenData;
      const token = spectrum.getTokenByAddress('0x90874');
      expect(token).toBeDefined();
    });
  });

  describe('ready', () => {
    it('Should be defined', () => {
      const spectrum = Spectrum.getInstance('ergo', 'mainnet');
      expect(spectrum.ready).toBeDefined();
    })
    it('Should return false if not ready', () => {
      const spectrum = Spectrum.getInstance('ergo', 'mainnet');
      expect(spectrum.ready()).toBe(false);
    })
  })

  describe('gasLimitEstimate', () => {
    it('Should be defined', () => {
      const spectrum = Spectrum.getInstance('ergo', 'mainnet');
      expect(spectrum.gasLimitEstimate).toBeDefined();
    })
    it('Should return gasLimitEstimate correctly', () => {
      const spectrum = Spectrum.getInstance('ergo', 'mainnet');
      expect(spectrum.gasLimitEstimate).toBe(150688);
    })
  })

  describe('init', () => {
    it('Should be defined', () => {
      const spectrum = Spectrum.getInstance('ergo', 'mainnet');
      expect(spectrum.init).toBeDefined();
    });
    it('Should not call init from ergo if ergo is ready', async () => {
      const spectrum = Spectrum.getInstance('ergo', 'mainnet');
      jest.spyOn(spectrum['ergo'], 'init').mockResolvedValue();
      jest.spyOn(spectrum['ergo'], 'ready').mockReturnValue(true);
      await spectrum.init();
      expect(spectrum['ergo'].init).not.toHaveBeenCalled();
      expect(spectrum['ergo'].ready).toHaveBeenCalled();
    });
    it('Should call init from ergo if ergo is not ready', async () => {
      const spectrum = Spectrum.getInstance('ergo', 'mainnet');
      jest.spyOn(spectrum['ergo'], 'ready').mockReturnValue(false);
      jest.spyOn(spectrum['ergo'], 'init').mockResolvedValue();
      await spectrum.init();
      expect(spectrum['ergo'].init).toHaveBeenCalled();
      expect(spectrum['ergo'].ready).toHaveBeenCalled();
    });
  });

  describe('estimateTrade', () => {
    it('should call ergo.estimate with correct parameters for SELL side', async () => {
      const spectrum = Spectrum.getInstance('ergo', 'mainnet');
      const request: PriceRequest = {
        chain: 'ergo',
        network: 'mainnet',
        connector: 'spectrum',
        base: 'ERG',
        quote: 'SIGUSD',
        amount: '10',
        side: 'SELL',
      };
      jest.spyOn(spectrum['ergo'], 'estimate').mockResolvedValue({
        price: '1.5',
        estimatedAmount: '15',
        fee: '0.1',
      } as any);
      const result = await spectrum.estimateTrade(request);
      expect(spectrum['ergo'].estimate).toHaveBeenCalledWith(
        'ERG',
        'SIGUSD',
        BigNumber('10'),
      );
      expect(result).toEqual({
        price: '1.5',
        estimatedAmount: '15',
        fee: '0.1',
      });
    });
  });

  describe('executeTrade', () => {
    it('Should be defined', () => {
      const spectrum = Spectrum.getInstance('ergo', 'mainnet');
      expect(spectrum.executeTrade).toBeDefined();
    });
    it('Should call ergo.execute with correct parameters', async () => {
      const spectrum = Spectrum.getInstance('ergo', 'mainnet');
      jest
        .spyOn(spectrum['ergo'], 'getAccountFromAddress')
        .mockResolvedValue('account' as any);
      jest.spyOn(spectrum['ergo'], 'swap').mockResolvedValue({} as any);
      const request: any = {
        chain: 'ergo',
        network: 'mainnet',
        connector: 'spectrum',
        base: 'ERG',
        quote: 'SIGUSD',
        amount: '10',
        side: 'SELL',
        address: 'address',
        limitPrice: '1.5',
      };
      const result = await spectrum.executeTrade(request);
      expect(result).toEqual({});
      expect(spectrum['ergo'].swap).toHaveBeenCalled();
      expect(spectrum['ergo'].getAccountFromAddress).toHaveBeenCalledWith('address')
    });
  });
});
