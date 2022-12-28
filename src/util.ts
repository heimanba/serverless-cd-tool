import * as dotenv from "dotenv";
import {
  lodash as _,
  getCredential,
  fse,
  commandParse,
  CatchableError,
} from "@serverless-devs/core";
import path from "path";
import { ICredentials, IInput } from "./common/entity";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const getExampleValue = (cwd: string) => {
  const envExampleFilePath = path.join(cwd, ".env.example");
  const envExampleFileExists = fse.existsSync(envExampleFilePath);
  return envExampleFileExists
    ? dotenv.config({ path: envExampleFilePath }).parsed
    : {};
};

export const getCred = async (inputs: IInput): Promise<ICredentials> => {
  const props = _.get(inputs, "props", {});
  if (props.ACCOUNTID && props.ACCESS_KEY_ID && props.ACCESS_KEY_SECRET) {
    return {
      AccountID: props.ACCOUNTID,
      AccessKeyID: props.ACCESS_KEY_ID,
      AccessKeySecret: props.ACCESS_KEY_SECRET,
    };
  }
  const access = _.get(inputs, "project.access");
  const credentials = _.get(inputs, "credentials", await getCredential(access));
  return {
    AccountID: credentials.AccountID,
    AccessKeyID: credentials.AccessKeyID,
    AccessKeySecret: credentials.AccessKeySecret,
  };
};

export const hasHelpOptions = (inputs: IInput): boolean => {
  const parsedArgs: { [key: string]: any } = commandParse(inputs, {
    boolean: ["help"],
    alias: { help: "h" },
  });
  return parsedArgs?.data?.help;
};

const _getCurrentPath = (inputs: any) => {
  const configPath = _.get(inputs, "path.configPath");
  if (!configPath) {
    return process.cwd();
  } else {
    try {
      const isDirectory = fse.lstatSync(configPath).isDirectory();
      return isDirectory ? configPath : path.dirname(configPath);
    } catch (error) {
      return process.cwd();
    }
  }
};

export const getSrcPath = async (inputs): Promise<string> => {
  const currentPath = _getCurrentPath(inputs);
  const isInRootPath = await fse.pathExists(
    path.join(currentPath, "publish.yaml")
  );
  const isInSrcPath = await fse.pathExists(
    path.join(currentPath, "generate.yaml")
  );
  let srcPath = "";
  // 在src目录下面才work
  if (isInRootPath) {
    srcPath = path.join(currentPath, "src");
  } else if (isInSrcPath) {
    srcPath = currentPath;
  } else {
    throw new CatchableError("请在serverless-cd 项目的根目录下面执行指令");
  }
  return srcPath;
};

/**
 * 异步重试一次
 * @param promiseFun
 * @param timer
 * @returns {Promise<*>}
 */
export async function retryOnce(promiseFun, timer = 500) {
  try {
    return await promiseFun;
  } catch (error) {
    sleep(timer);
    return await promiseFun;
  }
}
