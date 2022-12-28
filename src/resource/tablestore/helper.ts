import TableStore from 'tablestore';

const CREATED_OTS_DEFAULT_CONFIG = {
  tableOptions: {
    timeToLive: -1, //数据的过期时间，单位为秒，-1代表永不过期。如果设置过期时间为一年，即为365*24*3600。
    maxVersions: 1  //保存的最大版本数，设置为1代表每列上最多保存一个版本（保存最新的版本）。
  },
  reservedThroughput: {
    capacityUnit: {
      read: 0,
      write: 0
    },
  },
};

const ID_FIELD = {
  fieldName: 'id',
  fieldType: TableStore.FieldType.KEYWORD, // 设置字段名和字段类型。
  index: true, // 设置开启索引。
  enableSortAndAgg: true, // 设置开启排序与统计聚合功能。
  store: true, // 开启后，可以直接从多元索引中读取该字段的值，而不必反查数据表，可用于查询性能优化。
};


function getDefinedColumn(data: Record<string, number>): { type: number; name: string; }[] {
  return Object.keys(data).map(name => ({ name, type: data[name] }))
}

function getFieldSchemas(data: Record<string, number>): {
  fieldName: string;
  fieldType: number;
  index: boolean;
  enableSortAndAgg: boolean;
  store: boolean;
}[] {
  return Object.keys(data).map(fieldName => ({
    index: true,
    enableSortAndAgg: true,
    store: true,
    fieldType: data[fieldName],
    fieldName,
  }))
}

/*
Table user {
  id string [pk]
  avatar string
  username string // 名称
  password string // 登录密码(加密)
  secrets string  // 个人密钥
  third_part string // 三方绑定(github等)登录的信息
  github_unionid string  // github授权的唯一标识ID
  created_time timestamp
  updated_time timestamp
}
*/
const USER_DEFINED_COLUMN = {
  avatar: TableStore.DefinedColumnType.DCT_STRING, // 头像
  username: TableStore.DefinedColumnType.DCT_STRING, // 名称
  password: TableStore.DefinedColumnType.DCT_STRING, // 登录密码(加密)
  secrets: TableStore.DefinedColumnType.DCT_STRING, // 个人密钥
  third_part: TableStore.DefinedColumnType.DCT_STRING, // 三方绑定(github等)登录的信息
  github_unionid: TableStore.DefinedColumnType.DCT_STRING, // github授权的唯一标识ID
  created_time: TableStore.DefinedColumnType.DCT_INTEGER,
  updated_time: TableStore.DefinedColumnType.DCT_INTEGER,
}
export const user = (tableName: string) => ({
  tableMeta: {
    tableName,
    primaryKey: [
      { name: 'id', type: 'STRING' },
    ],
    definedColumn: getDefinedColumn(USER_DEFINED_COLUMN),
  },
  ...CREATED_OTS_DEFAULT_CONFIG,
});

export const userIndex = (tableName: string, indexName: string) => ({
  tableName,
  indexName,
  schema: {
    fieldSchemas: [
      ID_FIELD,
      ...getFieldSchemas(USER_DEFINED_COLUMN)
    ]
  },
});

/*
Table application {
  id string [pk, increment]
  user_id string  [ref: > user.id]
  description string
  owner string // github仓库登录的owner
  provider string // git代码托管厂商：github,gitee,gitlab,codeup
  provider_repo_id string // git代码repo唯一ID
  repo_name string // git代码repo 名称
  repo_url string // git代码repo url链接
  secrets string // 应用密钥secrets
  latest_task string // 最近生效的task信息
  trigger_spec string // trigger相关信息 
  created_time timestamp
  updated_time timestamp
}
*/
const APP_DEFINED_COLUMN = {
  user_id: TableStore.DefinedColumnType.DCT_STRING,
  webhook_id: TableStore.DefinedColumnType.DCT_STRING,
  owner: TableStore.DefinedColumnType.DCT_STRING,
  provider: TableStore.DefinedColumnType.DCT_STRING,
  provider_repo_id: TableStore.DefinedColumnType.DCT_STRING,
  repo_name: TableStore.DefinedColumnType.DCT_STRING,
  repo_url: TableStore.DefinedColumnType.DCT_STRING,
  secrets: TableStore.DefinedColumnType.DCT_STRING,
  latest_task: TableStore.DefinedColumnType.DCT_STRING,
  trigger_spec: TableStore.DefinedColumnType.DCT_STRING,
  created_time: TableStore.DefinedColumnType.DCT_INTEGER,
  updated_time: TableStore.DefinedColumnType.DCT_INTEGER,
}

export const application = (tableName: string) => ({
  tableMeta: {
    tableName,
    primaryKey: [
      { name: 'id', type: 'STRING' },
    ],
    definedColumn: getDefinedColumn(APP_DEFINED_COLUMN),
  },
  ...CREATED_OTS_DEFAULT_CONFIG,
});

export const applicationIndex = (tableName: string, indexName: string) => ({
  tableName,
  indexName,
  schema: {
    fieldSchemas: [
      ID_FIELD,
      ...getFieldSchemas(APP_DEFINED_COLUMN)
    ]
  },
})

/*
Table task {
  id string [pk, increment]
  user_id string  [ref: > user.id]
  app_id string [ref: > application.id]
  status string // 任务执行状态
  steps string // 执行steps的详细信息
  trigger_payload string // webhook触发相关的信息
  created_time timestamp
  updated_time timestamp
}
*/
const TASK_DEFINED_COLUMN = {
  user_id: TableStore.DefinedColumnType.DCT_STRING,
  description: TableStore.DefinedColumnType.DCT_STRING,
  app_id: TableStore.DefinedColumnType.DCT_STRING,
  status: TableStore.DefinedColumnType.DCT_STRING,
  steps: TableStore.DefinedColumnType.DCT_STRING,
  trigger_payload: TableStore.DefinedColumnType.DCT_STRING,
  created_time: TableStore.DefinedColumnType.DCT_INTEGER,
  updated_time: TableStore.DefinedColumnType.DCT_INTEGER,
}
export const task = (tableName: string) => ({
  tableMeta: {
    tableName,
    primaryKey: [
      { name: 'id', type: 'STRING' },
    ],
    definedColumn: getDefinedColumn(TASK_DEFINED_COLUMN),
  },
  ...CREATED_OTS_DEFAULT_CONFIG,
});

export const taskIndex = (tableName: string, indexName: string) => ({
  tableName,
  indexName,
  schema: {
    fieldSchemas: [
      ID_FIELD,
      ...getFieldSchemas(TASK_DEFINED_COLUMN)
    ]
  },
})


/*
Table token {
  id string [pk, increment]
  team_id string  [ref: > team.id]
  user_id string  [ref: > user.id]
  cd_token string
  description string
  active_time string
  expire_time string
  created_time timestamp
  updated_time timestamp
}
*/
const TOKEN_DEFINED_COLUMN = {
  team_id: TableStore.DefinedColumnType.DCT_STRING,
  user_id: TableStore.DefinedColumnType.DCT_STRING,
  cd_token: TableStore.DefinedColumnType.DCT_STRING,
  description: TableStore.DefinedColumnType.DCT_STRING,
  active_time: TableStore.DefinedColumnType.DCT_STRING,
  expire_time: TableStore.DefinedColumnType.DCT_STRING,
  created_time: TableStore.DefinedColumnType.DCT_INTEGER,
  updated_time: TableStore.DefinedColumnType.DCT_INTEGER,
}
export const token = (tableName: string) => ({
  tableMeta: {
    tableName,
    primaryKey: [
      { name: 'id', type: 'STRING' },
    ],
    definedColumn: getDefinedColumn(TOKEN_DEFINED_COLUMN),
  },
  ...CREATED_OTS_DEFAULT_CONFIG,
});

export const tokenIndex = (tableName: string, indexName: string) => ({
  tableName,
  indexName,
  schema: {
    fieldSchemas: [
      ID_FIELD,
      ...getFieldSchemas(TOKEN_DEFINED_COLUMN)
    ]
  },
})
