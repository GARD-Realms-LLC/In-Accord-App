/**
 * Test suite for main application
 */

const { main } = require('../src/index');

describe('In-Accord App', () => {
  test('main function should be defined', () => {
    expect(main).toBeDefined();
    expect(typeof main).toBe('function');
  });

  test('main function should execute without errors', () => {
    // Capture console output
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    main();
    
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });
});
