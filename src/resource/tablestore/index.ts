// refer: https://github.com/aliyun/aliyun-tablestore-nodejs-sdk
import { Client } from "tablestore";
import { lodash as _, popCore } from "@serverless-devs/core";
import { IProps } from "../../common/entity";
import { retryOnce } from "../../util";
import * as dbHelper from "./helper";
import logger from "../../common/logger";
import { OTS_INSTANCE_NAME } from "../../constants";

enum OtsAccess {
  OTS = "ots",
  TABLE_STORE = "tablestore",
}

export default class Ots {
  client: Client;
  popClient: any;
  dbConfig: any;
  envConfig: any;
  endpoint: string;

  constructor(envConfig: IProps) {
    this.envConfig = envConfig;
    this.popClient = new popCore({
      accessKeyId: envConfig.ACCESS_KEY_ID,
      accessKeySecret: envConfig.ACCESS_KEY_SECRET,
      endpoint: `https://ots.${envConfig.REGION}.aliyuncs.com`,
      apiVersion: "2016-06-20",
    });
    this.makeClient();

    this.dbConfig = [
      {
        name: envConfig.OTS_USER_TABLE_NAME,
        indexName: envConfig.OTS_USER_INDEX_NAME,
        genTableParams: dbHelper.user,
        genIndexParams: dbHelper.userIndex,
      },
      {
        name: envConfig.OTS_APP_TABLE_NAME,
        indexName: envConfig.OTS_APP_INDEX_NAME,
        genTableParams: dbHelper.application,
        genIndexParams: dbHelper.applicationIndex,
      },
      {
        name: envConfig.OTS_TASK_TABLE_NAME,
        indexName: envConfig.OTS_TASK_INDEX_NAME,
        genTableParams: dbHelper.task,
        genIndexParams: dbHelper.taskIndex,
      },
      {
        name: envConfig.OTS_TOKEN_TABLE_NAME,
        indexName: envConfig.OTS_TOKEN_INDEX_NAME,
        genTableParams: dbHelper.token,
        genIndexParams: dbHelper.tokenIndex,
      },
    ];
  }

  makeClient(access: OtsAccess = OtsAccess.OTS) {
    const envConfig = this.envConfig;
    this.endpoint = `https://${envConfig.OTS_INSTANCE_NAME}.${envConfig.REGION}.${access}.aliyuncs.com`;

    this.client = new Client({
      accessKeyId: envConfig.ACCESS_KEY_ID,
      accessKeySecret: envConfig.ACCESS_KEY_SECRET,
      // securityToken: credentials.SecurityToken,
      endpoint: this.endpoint,
      instancename: envConfig.OTS_INSTANCE_NAME,
      maxRetries: 20, // 默认20次重试，可以省略此参数。
    });
  }

  // 初始化实例
  async initInstance() {
    const popClient = this.popClient;
    const instanceName = this.envConfig?.OTS_INSTANCE_NAME || OTS_INSTANCE_NAME;
    let isExistInstance = false;
    logger.info(`Init Ots Instance ${instanceName} Start`);
    try {
      await popClient.request(
        "GetInstance",
        { InstanceName: instanceName },
        {
          method: "GET",
          formatParams: false,
        }
      );
      isExistInstance = true;
    } catch (error) {}

    if (isExistInstance) {
      logger.debug(`Ots Instance Exist ${instanceName} Exist`);
      logger.info(`Init Ots Instance ${instanceName} Success`);
      return;
    }
    logger.info(`Create Instance ${instanceName} Start...`);
    await popClient.request(
      "InsertInstance",
      { InstanceName: instanceName, ClusterType: "HYBRID" },
      {
        method: "POST",
        formatParams: false,
      }
    );
    logger.info(`Init Ots Instance ${instanceName} Success`);
  }

  async removeTable() {
    const dbConfig = this.dbConfig;
    for (const { name, indexName, genIndexParams } of dbConfig) {
      logger.info(`Remove tableIndex ${name}: ${indexName} start...`);
      try {
        await retryOnce(
          this.client.deleteSearchIndex(genIndexParams(name, indexName))
        );
      } catch (error) {}
      logger.info(`Remove tableIndex ${name}: ${indexName} success`);
      logger.info(`Remove table ${name} start...`);
      try {
        await retryOnce(this.client.deleteTable({ tableName: name }));
      } catch (error) {}
      logger.info(`Remove table ${name} success`);
    }
  }

  async removeInstance() {
    const instanceName = this.envConfig?.OTS_INSTANCE_NAME || OTS_INSTANCE_NAME;
    await this.popClient.request(
      "DeleteInstance",
      { InstanceName: instanceName },
      {
        method: "POST",
        formatParams: false,
      }
    );
  }

  async init() {
    await this.initInstance();
    for (const { name, indexName, genTableParams, genIndexParams } of this
      .dbConfig) {
      logger.debug(`handler ${name} start`);
      try {
        await this.createTable(name, genTableParams(name, this.envConfig));
      } catch (ex) {
        logger.debug(`handler table error: ${ex.message}`);
        if (
          ex?.code === "NetworkingError" &&
          ex?.message.startsWith("getaddrinfo ENOTFOUND")
        ) {
          this.makeClient(OtsAccess.TABLE_STORE);
          await this.createTable(name, genTableParams(name, this.envConfig));
        } else {
          throw ex;
        }
      }

      if (indexName) {
        await this.createIndex(
          name,
          indexName,
          genIndexParams(name, indexName)
        );
      }

      logger.debug(`handler ${name} end`);
    }
  }

  /**
   * 创建索引
   * @param tableName
   * @param indexName
   * @param params
   * @returns
   */
  private async createIndex(tableName: string, indexName: string, params: any) {
    logger.debug(`need handler index: ${indexName}`);
    try {
      await this.client.describeSearchIndex({ tableName, indexName });

      logger.debug(`check index ${indexName} exist, skip create`);
      return;
    } catch (ex) {
      logger.debug(`check index ${indexName} error: ${ex.message}`);
      if (ex.code !== 404) {
        throw ex;
      }
    }
    logger.debug(
      `need create index ${indexName}, params: ${JSON.stringify(
        params,
        null,
        2
      )}`
    );
    await this.client.createSearchIndex(params);
    logger.debug(`create index ${indexName} success`);
  }

  /**
   * 创建表
   * @param tableName c
   * @param params
   * @returns
   */
  private async createTable(tableName: string, params: any): Promise<Boolean> {
    logger.debug(`check table ${tableName}`);
    try {
      await this.client.describeTable({ tableName });
      logger.debug(`check table ${tableName} exist, skip create`);
      return;
    } catch (ex) {
      logger.debug(`check table ${tableName} error: ${ex.message}`);
      if (ex.code !== 404) {
        throw ex;
      }
    }
    logger.debug(
      `need create table ${tableName}, params: ${JSON.stringify(
        params,
        null,
        2
      )}`
    );
    await this.client.createTable(params);
    logger.debug(`create table ${tableName} success`);
  }
}
