describe('app version display', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('combines the native application version and build number', () => {
    jest.doMock('expo-application', () => ({
      nativeApplicationVersion: '2.0.0',
      nativeBuildVersion: '179',
    }));

    const { APP_VERSION_WITH_BUILD } = require('../constants') as {
      APP_VERSION_WITH_BUILD: string;
    };

    expect(APP_VERSION_WITH_BUILD).toBe('2.0.0 (179)');
  });

  it('falls back to the application version when a native build is unavailable', () => {
    jest.doMock('expo-application', () => ({
      nativeApplicationVersion: '2.0.0',
      nativeBuildVersion: null,
    }));

    const { APP_VERSION_WITH_BUILD } = require('../constants') as {
      APP_VERSION_WITH_BUILD: string;
    };

    expect(APP_VERSION_WITH_BUILD).toBe('2.0.0');
  });
});
