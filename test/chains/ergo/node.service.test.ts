import axios from 'axios';
import { NodeService } from '../../../src/chains/ergo/node.service';
import { NodeInfoResponse } from '../../../src/chains/ergo/interfaces/node.interface';

// Mock axios to avoid making real HTTP requests during tests
jest.mock('axios');

// Describe the test suite for the NodeService class
describe('NodeService', () => {
  // Define constants for baseURL and timeout
  const baseURL = 'https://example.com';
  const timeout = 5000;

  // Initialize NodeService instance
  const nodeService: NodeService = new NodeService(baseURL, timeout);

  // After each test, clear all mocks to ensure no interference between tests
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test case to check if NodeService is defined and its properties are set correctly
  it('Should be defined and and set nodeURL & timeout correctly', () => {
    // Assert: Check if the nodeURL and timeout properties are correctly set and instance is defined
    expect(nodeService).toBeDefined();
    expect(nodeService['nodeURL']).toEqual('https://example.com');
    expect(nodeService['timeout']).toEqual(5000);
  });

  describe('request', () => {
    // Define default parameters for the request method
    const method = 'GET';
    const url = '/test-endpoint';
    const headers = { 'Content-Type': 'application/json' };
    const body = { key: 'value' };

    // Test case for making a GET request with correct parameters
    it('Should make a GET request with correct parameters', async () => {
      // Arrange: Mock the axios response
      const mockResponse = { data: { name: 'test' } };
      (axios as any).mockResolvedValue(mockResponse);

      // Act: Call the private request method with GET parameters
      const response = await nodeService['request'](method, url, headers);

      // Assert: Check if axios was called with the correct configuration
      expect(axios).toHaveBeenCalledWith({
        baseURL,
        url,
        method,
        headers,
        timeout,
      });
      // Assert: Check if the response is as expected
      expect(response).toEqual({ name: 'test' });
    });

    // Test case for making a POST request with correct parameters
    it('Should make a POST request with correct parameters', async () => {
      // Arrange: Change method to POST and mock the axios response
      const method = 'POST';
      const mockResponse = { data: { name: 'test' } };
      (axios as any).mockResolvedValue(mockResponse);

      // Act: Call the private request method with POST parameters
      const response = await nodeService['request'](method, url, headers, body);

      // Assert: Check if axios was called with the correct configuration
      expect(axios).toHaveBeenCalledWith({
        baseURL,
        url,
        method,
        headers,
        timeout,
        body,
      });
      // Assert: Check if the response is as expected
      expect(response).toEqual({ name: 'test' });
    });
  });

  // Describe the test suite for the getNetworkHeight method
  describe('getNetworkHeight', () => {
    // Define a test case to check if getNetworkHeight is called with the correct parameters and returns the correct value
    it('should call getNetworkHeight with correct parameters and returns the correct value', async () => {
      // Define a mock response with fullHeight property
      const res: NodeInfoResponse = { fullHeight: 100 };
      // Mock the private request method of nodeService to resolve with the mock response
      jest.spyOn(nodeService as any, 'request').mockResolvedValue(res);

      // Call the getNetworkHeight method and store the result
      const networkHeight = await nodeService.getNetworkHeight();

      // Assert: Check if the returned network height is correct
      expect(networkHeight).toEqual(100);
      // Assert: Check if the private request method was called exactly once
      expect(nodeService['request']).toHaveBeenCalledTimes(1);
      // Assert: Check if the private request method was called with the correct HTTP method and URL
      expect(nodeService['request']).toHaveBeenCalledWith('GET', '/info');
    });
  });

  // Describe the test suite for the getUnspentBoxesByAddress method
  describe('getUnspentBoxesByAddress', () => {
    // Define constants for address, offset, and limit
    const address = 'box-number-1.com';
    const offset = 10;
    const limit = 20;

    // Define a test case to check if getUnspentBoxesByAddress is called with the correct parameters and returns the correct value
    it('Should call getUnspentBoxesByAddress method with correct parameters and returns the correct value', async () => {
      // Mock the private request method of nodeService to resolve with an empty data object
      jest.spyOn(nodeService as any, 'request').mockResolvedValue({ data: {} });
      // Call the getUnspentBoxesByAddress method with the defined address, offset, and limit, and store the result
      const unspentBoxesByAddress = await nodeService.getUnspentBoxesByAddress(
        address,
        offset,
        limit,
      );

      // Assert: Check if the returned value matches the mock response
      expect(unspentBoxesByAddress).toEqual({ data: {} });
      // Assert: Check if the private request method was called exactly once
      expect(nodeService['request']).toHaveBeenCalledTimes(1);
      // Assert: Check if the private request method was called with the correct HTTP method, URL, headers, and body
      expect(nodeService['request']).toHaveBeenCalledWith(
        'POST',
        `/blockchain/box/unspent/byAddress?offset=10&limit=20&sortDirection=desc`,
        { 'Content-Type': 'text/plain' },
        'box-number-1.com',
      );
    });
  });
});