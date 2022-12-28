import { lodash as _, fse, help } from "@serverless-devs/core";
import { inquirer } from "@serverless-devs/core";
import { hasHelpOptions, getCred } from "../util";
import { IInput } from "../common/entity";
import logger from "../common/logger";
import * as constants from "../constants";
import Oss from "../resource/oss";
import Ots from "../resource/tablestore";
import Domain from "../resource/domain";

const hasCommandHelp = (inputs: IInput) => {
  const isHelp = hasHelpOptions(inputs);
  if (isHelp) {
    help([
      {
        header: "Description",
        content: "Generate Cloud Resource for serverless-cd",
      },
      {
        header: "Usage",
        content: "$ s generate [options]",
      },
    ]);
    return true;
  }
};

// TODO: 如果 .env 已经存在，优先使用配置文件
const promptOverwriteEnv = async (envFilePath) => {
  if (fse.existsSync(envFilePath)) {
    const answers: any = await inquirer.prompt([
      {
        type: "list",
        name: "overwrite",
        message: `${envFilePath} is exised, determine whether to overwrite the file. Exit if not overwritten`,
        choices: ["yes", "no"],
      },
    ]);
    if (answers.overwrite === "no") {
      return false;
    }
  }
  return true;
};

// 获取默认的环境变量配置
const getDefaultEnvConfig = async (inputs) => {
  const { props = {} } = inputs;
  const dbPrefix = _.get(props, "dbPrefix", "cd");
  const omitProps = _.omit(props, ["dbPrefix", "serviceName"]);
  const withOtsValue = _.mapValues(
    _.defaults(omitProps, constants.OTS_DEFAULT_CONFIG),
    (value, key) => {
      if (_.has(constants.OTS_DEFAULT_CONFIG, key)) {
        return `${dbPrefix}_${value}`;
      }
      return value;
    }
  );
  logger.debug(`with transform ots values: ${JSON.stringify(withOtsValue)}`);

  const credentials = await getCred(inputs);
  const envConfig = _.merge(constants.OTHER_DEFAULT_CONFIG, withOtsValue, {
    ACCOUNTID: credentials.AccountID,
    ACCESS_KEY_ID: credentials.AccessKeyID,
    ACCESS_KEY_SECRET: credentials.AccessKeySecret,
  });
  return envConfig;
};

// 生成默认OSS资源
const generateOssResource = async (envConfig) => {
  logger.info("Generate bucket resource start...");
  let oss;
  if (_.toLower(envConfig.OSS_BUCKET) === "auto") {
    oss = new Oss(envConfig);
    await oss.putBucket();
    envConfig.OSS_BUCKET = oss.bucketName;
  }
  await oss.client.putBucketLifecycle(envConfig.OSS_BUCKET, [
    {
      id: 'logs_rule',
      status: 'Enabled',
      prefix: 'logs/',
      expiration: {
        // TODO: 让用户自定义
        days: 30
      }
    }
  ]);
  logger.info("Generate bucket resource success");
};

// 生成域名
const generateDomainResource = async (envConfig, inputs) => {
  const { project, props } = inputs;
  logger.info("Generate domain resource start");
  if (_.toLower(envConfig.DOMAIN) === "auto") {
    const domain = new Domain({
      project,
      credentials: _.pick(envConfig, [
        "AccountID",
        "AccessKeyID",
        "AccessKeySecret",
        "SecurityToken",
      ]),
      appName: "get-domain",
    });
    envConfig.DOMAIN = await domain.get({
      type: "fc",
      user: envConfig.ACCOUNTID,
      region: envConfig.REGION,
      service: _.get(props, "serviceName", "serverless-cd"),
      function: "auto",
    });
  } else if (_.includes(envConfig.DOMAIN, "://")) {
    envConfig.DOMAIN = envConfig.DOMAIN.split("://")[1]; // 不带协议
  }
  logger.info("Generate domain resource success");
};

// 生成OTS数据库
const generateOtsResource = async (envConfig) => {
  logger.info("Generate ots resource start");
  const ots = new Ots(envConfig);
  await ots.init();
  logger.info("Generate ots resource success");
}

export default {
  hasCommandHelp,
  promptOverwriteEnv,
  getDefaultEnvConfig,
  generate: async (envConfig, inputs) => {
    await generateOssResource(envConfig);
    await generateDomainResource(envConfig, inputs);
    await generateOtsResource(envConfig);
  },
};
