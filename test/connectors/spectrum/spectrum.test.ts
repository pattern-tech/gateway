import { Ergo } from '../../../src/chains/ergo/ergo';
import { Spectrum } from '../../../src/connectors/spectrum/spectrum';

describe('Spectrum', () => {
  it('Should be defined', () => {
    expect(Spectrum).toBeDefined();
  });
  beforeEach(() => {
    jest.spyOn(Ergo, 'getInstance').mockReturnValue({} as any);
  })

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
  
});
