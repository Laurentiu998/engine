import db, { Patch } from 'jsonmvc-datastore';
import get from 'lodash/get';
import {
  Producer,
  OperationTypes,
  ValueTypes,
  ProducerArgs,
  ExternalProps,
  Operation
} from './';

interface TestBody {
  args: ProducerArgs;
  expect: {
    state?: any;
    calls?: any[];
    ref?: {
      [key: string]: {
        get: {
          params: {
            [key: string]: any;
          };
          expectedValue: any;
        };
      };
    };
  };
  patches?: Patch[];
  invoke?: {
    [key: string]: any[];
  };
  state?: any;
  props?: ExternalProps;
}

const createTest = (config: TestBody) => () => {
  const fn = jest.fn((args: any) => {
    if (config.invoke) {
      Object.keys(config.invoke).forEach(x => {
        const fn = get(args, x);
        expect(fn).toBeInstanceOf(Function);
        fn.apply(null, config.invoke && config.invoke[x]);
      });
    }
    if (config.expect.ref) {
      Object.keys(config.expect.ref).forEach(x => {
        const val = config.expect.ref && config.expect.ref[x];
        if (!val) {
          return;
        }
        const ref = get(args, x);
        if (val.get) {
          expect(ref.get(val.get.params)).toBe(val.get.expectedValue);
        }
      });
    }
  });
  const instance = {
    context: {
      db: db(config.state || {}),
      props: config.props || {}
    },
    config: {
      args: config.args,
      fn
    }
  };
  const producer = new Producer(instance.config, instance.context);
  producer.mount();
  if (config.patches) {
    instance.context.db.patch(config.patches);
  }

  jest.runAllTimers();
  if (config.expect.calls) {
    expect(fn).toBeCalledTimes(config.expect.calls.length);
    config.expect.calls.forEach((x, i) => {
      expect(fn).toHaveBeenNthCalledWith(i + 1, expect.objectContaining(x));
    });
  }
  if (config.expect.state) {
    const value = instance.context.db.get('/');
    delete value.err;
    expect(value).toMatchObject(config.expect.state);
  }
};

jest.useFakeTimers();
test(
  'Should support Value operations with CONST values',
  createTest({
    args: {
      color: {
        type: OperationTypes.VALUE,
        value: {
          type: ValueTypes.CONST,
          value: 'red'
        }
      }
    },
    expect: {
      calls: [{ color: 'red' }]
    }
  })
);

test(
  'Should support Value operations with INTERNAL values',
  createTest({
    args: {
      color: {
        type: OperationTypes.VALUE,
        value: {
          type: ValueTypes.CONST,
          value: 'red'
        }
      },
      colorCopy: {
        type: OperationTypes.VALUE,
        value: {
          type: ValueTypes.INTERNAL,
          path: ['color']
        }
      }
    },
    expect: {
      calls: [{ color: 'red', colorCopy: 'red' }]
    }
  })
);

test(
  'Shouls support Value operations with EXTERNAL values',
  createTest({
    args: {
      color: {
        type: OperationTypes.VALUE,
        value: {
          type: ValueTypes.EXTERNAL,
          path: ['color']
        }
      }
    },
    props: {
      color: 'red'
    },
    expect: {
      calls: [{ color: 'red' }]
    }
  })
);

test(
  'Should support path operations with CONST values',
  createTest({
    args: {
      color: {
        type: OperationTypes.GET,
        path: [
          { type: ValueTypes.CONST, value: 'color' },
          { type: ValueTypes.CONST, value: 'sample' }
        ]
      }
    },
    state: {
      color: {
        sample: 'red'
      }
    },
    expect: {
      calls: [{ color: 'red' }]
    }
  })
);

test(
  'Should support path operations with EXTERNAL values',
  createTest({
    args: {
      isAvailable: {
        type: OperationTypes.GET,
        path: [
          { type: ValueTypes.CONST, value: 'colors' },
          { type: ValueTypes.EXTERNAL, path: ['color'] },
          { type: ValueTypes.CONST, value: 'available' }
        ]
      }
    },
    state: {
      colors: {
        red: {
          available: true
        }
      }
    },
    props: {
      color: 'red'
    },
    expect: {
      calls: [{ isAvailable: true }]
    }
  })
);

test(
  'Should support path operations with INTERNAL values',
  createTest({
    args: {
      color: {
        type: OperationTypes.VALUE,
        value: {
          type: ValueTypes.CONST,
          value: 'red'
        }
      },
      isAvailable: {
        type: OperationTypes.GET,
        path: [
          { type: ValueTypes.CONST, value: 'colors' },
          { type: ValueTypes.INTERNAL, path: ['color'] },
          { type: ValueTypes.CONST, value: 'available' }
        ]
      }
    },
    state: {
      colors: {
        red: {
          available: true
        }
      }
    },
    props: {
      color: 'red'
    },
    expect: {
      calls: [{ isAvailable: true, color: 'red' }]
    }
  })
);

test(
  'Should support a structured operation',
  createTest({
    args: {
      color: {
        type: OperationTypes.STRUCT,
        value: {
          id: {
            type: OperationTypes.GET,
            path: [{ type: ValueTypes.CONST, value: ['selectedColor'] }]
          },
          name: {
            type: OperationTypes.GET,
            path: [
              { type: ValueTypes.CONST, value: 'colors' },
              { type: ValueTypes.INTERNAL, path: ['color', 'id'] },
              { type: ValueTypes.CONST, value: 'name' }
            ]
          },
          thing: {
            type: OperationTypes.STRUCT,
            value: {
              name: {
                type: OperationTypes.GET,
                path: [
                  { type: ValueTypes.CONST, value: 'thing' },
                  { type: ValueTypes.INTERNAL, path: ['color', 'id'] }
                ]
              },
              contains: {
                type: OperationTypes.GET,
                path: [
                  {
                    type: ValueTypes.CONST,
                    value: 'contains'
                  },
                  {
                    type: ValueTypes.INTERNAL,
                    path: ['color', 'id']
                  },
                  {
                    type: ValueTypes.INTERNAL,
                    path: ['color', 'thing', 'name']
                  }
                ]
              }
            }
          }
        }
      }
    },
    state: {
      selectedColor: 'blue',
      contains: {
        blue: {
          water: 'fish'
        }
      },
      thing: {
        blue: 'water'
      },
      colors: {
        blue: {
          name: 'Blue'
        }
      }
    },
    expect: {
      calls: [
        {
          color: {
            id: 'blue',
            name: 'Blue',
            thing: { name: 'water', contains: 'fish' }
          }
        }
      ]
    }
  })
);

test(
  'Should support Set operations',
  createTest({
    args: {
      setProp: {
        type: OperationTypes.SET,
        path: [
          {
            type: ValueTypes.CONST,
            value: 'items'
          },
          {
            type: ValueTypes.INVOKE,
            name: 'id'
          },
          {
            type: ValueTypes.CONST,
            value: 'value'
          }
        ]
      }
    },
    state: {
      items: {
        foo: {
          value: 'first'
        }
      }
    },
    invoke: {
      setProp: ['second', { id: 'foo' }]
    },
    expect: {
      state: {
        items: {
          foo: {
            value: 'second'
          }
        }
      }
    }
  })
);

test(
  'Should support Merge operations',
  createTest({
    args: {
      mergeProp: {
        type: OperationTypes.MERGE,
        path: [
          {
            type: ValueTypes.CONST,
            value: 'items'
          },
          {
            type: ValueTypes.INVOKE,
            name: 'id'
          }
        ]
      }
    },
    state: {
      items: {
        foo: {
          first: true
        }
      }
    },
    invoke: {
      mergeProp: [{ second: true }, { id: 'foo' }]
    },
    expect: {
      state: {
        items: {
          foo: {
            first: true,
            second: true
          }
        }
      }
    }
  })
);

test(
  'Should support Ref operations with get',
  createTest({
    args: {
      propRef: {
        type: OperationTypes.REF,
        path: [
          {
            type: ValueTypes.CONST,
            value: 'items'
          },
          {
            type: ValueTypes.INVOKE,
            name: 'id'
          },
          {
            type: ValueTypes.CONST,
            value: 'value'
          }
        ]
      }
    },
    state: {
      items: {
        foo: {
          value: 'first'
        }
      }
    },
    expect: {
      ref: {
        propRef: {
          get: {
            params: {
              id: 'foo'
            },
            expectedValue: 'first'
          }
        }
      }
    }
  })
);

test(
  'Should support Ref operations with set',
  createTest({
    args: {
      propRef: {
        type: OperationTypes.REF,
        path: [
          {
            type: ValueTypes.CONST,
            value: 'items'
          },
          {
            type: ValueTypes.INVOKE,
            name: 'id'
          },
          {
            type: ValueTypes.CONST,
            value: 'value'
          }
        ]
      }
    },
    state: {
      items: {
        foo: {
          value: 'first'
        }
      }
    },
    invoke: {
      'propRef.set': ['second', { id: 'foo' }]
    },
    expect: {
      state: {
        items: {
          foo: {
            value: 'second'
          }
        }
      }
    }
  })
);

test(
  'Should support Ref operations with merge',
  createTest({
    args: {
      propRef: {
        type: OperationTypes.REF,
        path: [
          {
            type: ValueTypes.CONST,
            value: 'items'
          },
          {
            type: ValueTypes.INVOKE,
            name: 'id'
          }
        ]
      }
    },
    state: {
      items: {
        foo: {
          first: true
        }
      }
    },
    invoke: {
      'propRef.merge': [{ second: true }, { id: 'foo' }]
    },
    expect: {
      state: {
        items: {
          foo: {
            first: true,
            second: true
          }
        }
      }
    }
  })
);

test(
  'Should support Func operations',
  createTest({
    args: {
      a: {
        type: OperationTypes.GET,
        path: [{ type: ValueTypes.CONST, value: 'a' }]
      },
      result: {
        type: OperationTypes.FUNC,
        value: {
          params: [
            {
              type: OperationTypes.VALUE,
              value: { type: ValueTypes.INTERNAL, path: ['a'] }
            },
            {
              type: OperationTypes.GET,
              path: [{ type: ValueTypes.CONST, value: 'b' }]
            }
          ],
          fn: (arg0, arg1) => arg0 + arg1
        }
      }
    },
    state: {
      a: 1,
      b: 2
    },
    expect: {
      calls: [{ a: 1, result: 3 }]
    }
  })
);

test(
  'Should react to changing state changes with INTERNAL deps',
  createTest({
    args: {
      foo: {
        type: OperationTypes.GET,
        path: [{ type: ValueTypes.CONST, value: 'foo' }]
      },
      bar: {
        type: OperationTypes.VALUE,
        value: {
          type: ValueTypes.INTERNAL,
          path: ['foo']
        }
      },
      baz: {
        type: OperationTypes.VALUE,
        value: {
          type: ValueTypes.INTERNAL,
          path: ['bar']
        }
      }
    },
    state: {
      foo: 'first'
    },
    patches: [
      {
        op: 'add',
        path: '/foo',
        value: 'second'
      },
      {
        op: 'add',
        path: '/bam',
        value: '123'
      }
    ],
    expect: {
      calls: [
        { foo: 'first', bar: 'first', baz: 'first' },
        { foo: 'second', bar: 'second', baz: 'second' }
      ]
    }
  })
);

test(
  'Should react to changing state changes complex args',
  createTest({
    args: {
      selectedId: {
        type: OperationTypes.GET,
        path: [{ type: ValueTypes.CONST, value: 'selectedId' }]
      },
      article: {
        type: OperationTypes.STRUCT,
        value: {
          ref: {
            type: OperationTypes.REF,
            path: [
              {
                type: ValueTypes.CONST,
                value: 'articles'
              },
              {
                type: ValueTypes.CONST,
                value: 'list'
              },
              {
                type: ValueTypes.INTERNAL,
                path: ['selectedId']
              },
              {
                type: ValueTypes.INVOKE,
                name: 'prop'
              }
            ]
          },
          name: {
            type: OperationTypes.GET,
            path: [
              {
                type: ValueTypes.CONST,
                value: 'articles'
              },
              {
                type: ValueTypes.CONST,
                value: 'list'
              },
              {
                type: ValueTypes.INTERNAL,
                path: ['selectedId']
              },
              {
                type: ValueTypes.CONST,
                value: 'name'
              }
            ]
          }
        }
      },
      name: {
        type: OperationTypes.VALUE,
        value: {
          type: ValueTypes.INTERNAL,
          path: ['article', 'name']
        }
      }
    },
    state: {
      selectedId: '123',
      articles: {
        list: {
          '123': {
            name: 'first'
          },
          '321': {
            name: 'second'
          }
        }
      }
    },
    invoke: {
      'article.ref.set': ['second', { prop: 'name' }]
    },
    expect: {
      calls: [{ name: 'first' }, { name: 'second' }]
    }
  })
);

test('Should react accordingly to state changes from patches', () => {
  const fn = jest.fn((args: any) => {});

  const state = {
    id: '123',
    list: {
      '123': 'foo',
      '321': 'bar'
    }
  };

  const args: ProducerArgs = {
    id: {
      type: OperationTypes.GET,
      path: [{ type: ValueTypes.CONST, value: 'id' }]
    },
    value: {
      type: OperationTypes.GET,
      path: [
        {
          type: ValueTypes.CONST,
          value: 'list'
        },
        {
          type: ValueTypes.INTERNAL,
          path: ['id']
        }
      ]
    }
  };
  const instance = {
    context: {
      db: db(state),
      props: {}
    },
    config: {
      args,
      fn
    }
  };

  const producer = new Producer(instance.config, instance.context);
  producer.mount();
  instance.context.db.patch([
    {
      op: 'add',
      path: '/id',
      value: '321'
    }
  ]);

  jest.runAllTimers();
  instance.context.db.patch([
    {
      op: 'add',
      path: '/list/321',
      value: 'baz'
    }
  ]);

  jest.runAllTimers();
  instance.context.db.patch([
    {
      op: 'add',
      path: '/id',
      value: '123'
    },
    {
      op: 'add',
      path: '/list/123',
      value: 'bap'
    }
  ]);
  jest.runAllTimers();
  expect(fn).toHaveBeenLastCalledWith(
    expect.objectContaining({
      id: '123',
      value: 'bap'
    })
  );
});

test('Should react accordingly to func declarations against external patches', () => {
  const fn = jest.fn((args: any) => {
    // console.log(args);
  });

  const state = {
    first: 1,
    second: 1,
    third: 1
  };

  const args: ProducerArgs = {
    first: {
      type: OperationTypes.GET,
      path: [{ type: ValueTypes.CONST, value: 'first' }]
    },
    second: {
      type: OperationTypes.GET,
      path: [{ type: ValueTypes.CONST, value: 'second' }]
    },
    sum: {
      type: OperationTypes.FUNC,
      value: {
        params: [
          {
            type: OperationTypes.VALUE,
            value: {
              type: ValueTypes.INTERNAL,
              path: ['first']
            }
          },
          {
            type: OperationTypes.VALUE,
            value: {
              type: ValueTypes.INTERNAL,
              path: ['second']
            }
          },
          {
            type: OperationTypes.GET,
            path: [{ type: ValueTypes.CONST, value: 'third' }]
          }
        ],
        fn: (arg1, arg2, arg3) => arg1 + arg2 + arg3
      }
    }
  };

  const instance = {
    context: {
      db: db(state),
      props: {}
    },
    config: {
      args,
      fn
    }
  };

  const producer = new Producer(instance.config, instance.context);
  producer.mount();

  jest.runAllTimers();
  expect(fn).toHaveBeenLastCalledWith(
    expect.objectContaining({
      first: 1,
      second: 1,
      sum: 3
    })
  );

  instance.context.db.patch([
    {
      op: 'add',
      path: '/first',
      value: 2
    }
  ]);
  jest.runAllTimers();
  expect(fn).toHaveBeenLastCalledWith(
    expect.objectContaining({
      first: 2,
      second: 1,
      sum: 4
    })
  );
  return;

  instance.context.db.patch([
    {
      op: 'add',
      path: '/third',
      value: 2
    }
  ]);
  jest.runAllTimers();
  expect(fn).toHaveBeenLastCalledWith(
    expect.objectContaining({
      first: 2,
      second: 1,
      sum: 5
    })
  );
  // expect(fn).toHaveBeenLastCalledWith(
  //   expect.objectContaining({
  //     id: '123',
  //     value: 'bap'
  //   })
  // );
});
