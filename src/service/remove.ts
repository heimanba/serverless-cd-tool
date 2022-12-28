import {
  lodash as _,
  fse,
  CatchableError,
  help,
  commandParse,
  execCommand,
} from "@serverless-devs/core";
import path from "path";
import * as dotenv from "dotenv";
import logger from "../common/logger";
import { hasHelpOptions, getSrcPath } from "../util";
import { IInput } from "../common/entity";
import Ots from "../resource/tablestore";
import Oss from "../resource/oss";
import generateService from "./generate";

const hasCommandHelp = (inputs: IInput) => {
  const isHelp = hasHelpOptions(inputs);
  if (isHelp) {
    help([
      {
        header: "Usage",
        content: "$ s remove [options]",
      },
      {
        header: "Options",
        optionList: [
          {
            name: "yaml",
            description: '[Optional] target yaml to remove (default: "s.yaml")',
            type: String,
          },
          {
            name: "all",
            description: "[Optional] remove all resource",
            type: Boolean,
          },
          {
            name: "deep",
            description: "[Optional] deep remove (default false)",
            type: Boolean,
          },
          {
            name: "type",
            description: `[Optional] resource name like: oss,ots,fc,nas
            Run " s cli serverless-cd-tool remove --type='oss,ots' " to remove`,
            type: String,
          },
        ],
      },
    ]);
    return true;
  }
};

const getInputCommandOptions = (inputs: IInput) => {
  const parsedArgs: { [key: string]: any } = commandParse(inputs, {
    boolean: ["help", "all", "deep"],
    string: ["type", "yaml"],
  });
  const { data } = parsedArgs;
  const types = _.filter(
    _.map(_.split(data.type, ","), (item) => _.trim(item))
  );

  const getYamlName = _.isEmpty(_.trim(data.yaml))
    ? "s.yaml"
    : _.trim(data.yaml);

  return {
    all: data?.all,
    types: types,
    deep: data?.deep,
    yaml: getYamlName,
  };
};

/**
 * 删除函数计算FC资源
 * @param inputs
 * @param targetYaml
 */
const removeFcResource = async (inputs, targetYaml) => {
  logger.info("Remove FC resource start...");
  try {
    await execCommand({
      syaml: targetYaml,
      method: "remove",
      args: ["-y"],
    });
    logger.info("Remove FC resource success...");
  } catch (error) {
    logger.info("Remove FC resource success...");
  }
};

/**
 * 删除OTS 数据库组资源
 * @param inputs
 * @param targetYaml
 */
const removeOtsResource = async (envs, deep) => {
  const ots = new Ots(envs);
  logger.info("Remove OTS resource start...");
  await ots.removeTable();
  logger.info("Remove OTS resource success...");
  if (deep) {
    try {
      await ots.removeInstance();
    } catch (error) {}
  }
};

const removeOssResource = async (envs, deep) => {
  logger.info("Remove OSS resource start...");
  const oss = new Oss(envs);
  await oss.deletePrefix("logs/");
  await oss.client.deleteBucketLifecycle(envs.OSS_BUCKET);
  logger.info("Remove OSS resource success...");
  const isAutoCreate =
    `${envs.ACCOUNTID}-${envs.REGION}-serverless-cd` === envs.OSS_BUCKET;
  // 自动创建的资源进行删除
  if (deep && isAutoCreate) {
    await oss.client.deleteBucket(envs.OSS_BUCKET);
  }
};

const remove = async (inputs) => {
  const srcPath = await getSrcPath(inputs);
  const inputOptions = getInputCommandOptions(inputs);
  const envFilePath = path.join(srcPath, ".env");
  const envObject = dotenv.config({ path: envFilePath }).parsed;
  const defaultDnvConfig = await generateService.getDefaultEnvConfig(inputs);
  const envs = _.merge(defaultDnvConfig, envObject);
  const targetYaml = path.join(srcPath, inputOptions.yaml);
  if (!fse.existsSync(targetYaml)) {
    throw new CatchableError(`yaml path ${targetYaml} not exist`);
  }
  const isAll = inputOptions.all;
  const types = inputOptions.types;
  const deep = inputOptions.deep;

  if (isAll) {
    await removeFcResource(inputs, targetYaml);
    await removeOtsResource(envs, deep);
    await removeOssResource(envs, deep);
  } else {
    if (_.includes(types, "fc")) {
      await removeFcResource(inputs, targetYaml);
    }
    if (_.includes(types, "ots")) {
      await removeOtsResource(envs, deep);
    }
    if (_.includes(types, "oss")) {
      await removeOssResource(envs, deep);
    }
  }
};
export default {
  hasCommandHelp,
  remove,
};
