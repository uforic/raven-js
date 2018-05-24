import {
  _callOnClient,
  addBreadcrumb,
  captureEvent,
  captureException,
  captureMessage,
  clearScope,
  configureScope,
  getCurrentClient,
  popScope,
  pushScope,
  ScopeInstance,
  withScope,
} from '../../src';
import { init, TestClient, TestClient2 } from '../mocks/client';

declare var global: any;

describe('Shim', () => {
  beforeEach(() => {
    global.__SENTRY__ = {
      shim: undefined,
      stack: [],
    };
  });

  describe('Capture', () => {
    test('Exception', () => {
      const client = {
        captureException: jest.fn(async () => Promise.resolve()),
      };
      withScope(client, () => {
        const e = new Error('test exception');
        captureException(e);
        expect(client.captureException.mock.calls[0][0]).toBe(e);
      });
    });

    test('Message', () => {
      const client = { captureMessage: jest.fn(async () => Promise.resolve()) };
      withScope(client, () => {
        const message = 'yo';
        captureMessage(message);
        expect(client.captureMessage.mock.calls[0][0]).toBe(message);
      });
    });

    test('Event', () => {
      const client = { captureEvent: jest.fn(async () => Promise.resolve()) };
      withScope(client, () => {
        const e = { message: 'test' };
        captureEvent(e);
        expect(client.captureEvent.mock.calls[0][0]).toBe(e);
      });
    });
  });

  describe('configureScope', () => {
    test('User Context', () => {
      const client = {
        setContext: jest.fn(),
      };
      pushScope(client);
      configureScope((scope: ScopeInstance) => {
        scope.setUserContext({ id: '1234' });
      });
      expect(client.setContext.mock.calls[0][0]).toEqual({
        user: { id: '1234' },
      });
      popScope();
    });

    test('Extra Context', () => {
      const client = { setContext: jest.fn() };
      pushScope(client);
      configureScope((scope: ScopeInstance) => {
        scope.setExtraContext({ id: '1234' });
      });
      expect(client.setContext.mock.calls[0][0]).toEqual({
        extra: { id: '1234' },
      });
      popScope();
    });

    test('Tags Context', () => {
      const client = {
        setContext: jest.fn(),
      };
      pushScope(client);
      configureScope((scope: ScopeInstance) => {
        scope.setTagsContext({ id: '1234' });
      });
      expect(client.setContext.mock.calls[0][0]).toEqual({
        tags: { id: '1234' },
      });
      popScope();
    });

    test('Fingerprint', () => {
      init({});
      configureScope((scope: ScopeInstance) => {
        scope.setFingerprint('abcd');
      });
      expect(global.__SENTRY__.stack[0].fingerprint).toEqual(['abcd']);
    });
  });

  test('Clear Scope', () => {
    const client = {
      getInitialScope: () => ({ context: {} }),
      setContext: (nextContext: any, scope: any) => {
        const sc = scope.context;
        sc.user = { ...nextContext.user };
      },
    };
    withScope(client, () => {
      expect(global.__SENTRY__.stack.length).toBe(2);
      configureScope((scope: ScopeInstance) => {
        scope.setUserContext({ id: '1234' });
      });
      expect(global.__SENTRY__.stack[1].scope).toEqual({
        context: { user: { id: '1234' } },
      });
      clearScope();
      expect(global.__SENTRY__.stack[1].scope).toEqual({ context: {} });
    });
  });

  test('Add Breadcrumb', () => {
    const client = {
      addBreadcrumb: jest.fn(),
    };
    pushScope(client);
    addBreadcrumb({ message: 'world' });
    expect(client.addBreadcrumb.mock.calls[0][0]).toEqual({
      message: 'world',
    });
    popScope();
  });

  test('returns undefined before binding a client', () => {
    expect(getCurrentClient()).toBeUndefined();
  });

  test('returns the bound client', () => {
    init({});
    expect(getCurrentClient()).toBe(TestClient.instance);
  });

  test('Calls function on the client', done => {
    const s = jest.spyOn(TestClient.prototype, 'mySecretPublicMethod');
    withScope(new TestClient({}), () => {
      _callOnClient('mySecretPublicMethod', 'test');
      expect(s.mock.calls[0][0]).toBe('test');
      s.mockRestore();
      done();
    });
  });

  test('does not throw an error when pushing different clients', () => {
    init({});
    expect(() => {
      withScope(new TestClient2(), () => {
        //
      });
    }).not.toThrow();
  });

  test('does not throw an error when pushing same clients', () => {
    init({});
    expect(() => {
      withScope(new TestClient({}), () => {
        //
      });
    }).not.toThrow();
  });
});