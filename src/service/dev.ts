import {
  lodash as _,
  fse,
  CatchableError,
  help,
  commandParse,
} from "@serverless-devs/core";
import path from "path";
import logger from "../common/logger";
import * as dotenv from "dotenv";
import { hasHelpOptions, getSrcPath } from "../util";
import { IInput } from "../common/entity";

function replaceFun(str, obj) {
  const reg = /\{\{(.*?)\}\}/g;
  let arr = str.match(reg);
  if (arr) {
    for (let i = 0; i < arr.length; i++) {
      let keyContent = arr[i].replace(/{{|}}/g, "");
      let realKey = _.trim(keyContent.split("|")[0]);
      str = str.replace(arr[i], obj[realKey]);
    }
  }
  return str;
}

const checkEnv = async (inputs) => {
  const currentPath = await getSrcPath(inputs);
  // .env文件不存在，报错提示，不进入下一步操作
  const envFilePath = path.join(currentPath, ".env");
  if (!fse.existsSync(envFilePath)) {
    throw new CatchableError(
      '请重新执行 " s init serverless-cd "生成.env文件，并拷贝到当前" src " 目录'
    );
  }
};

const replaceTemplateWithEnv = async (inputs) => {
  const srcPath = await getSrcPath(inputs);
  const inputOptions = getInputCommandOptions(inputs);
  logger.debug(`input options: ${JSON.stringify(inputOptions)}`);

  // 获取.env文件
  const envFilePath = path.join(srcPath, ".env");
  const envObject = dotenv.config({ path: envFilePath }).parsed;

  const devYamlPath = path.join(srcPath, "s.dev.yaml");
  // 拷贝s.yaml -> s.dev.yaml
  await fse.copy(path.join(srcPath, "s.yaml"), devYamlPath);

  // 获取s.dev.yaml文件，并解析模版字符
  const devYamlContent = await fse.readFile(devYamlPath);
  const realDevTemplate = replaceFun(devYamlContent.toString(), {
    serviceName: inputOptions.serviceName || envObject.serviceName,
    access: inputOptions.access || envObject.access,
  });
  await fse.writeFile(devYamlPath, realDevTemplate);
};

const hasCommandHelp = (inputs: IInput) => {
  const isHelp = hasHelpOptions(inputs);
  if (isHelp) {
    help([
      {
        header: "Usage",
        content: "$ s dev [options]",
      },
      {
        header: "Options",
        optionList: [
          {
            name: "access",
            description: '[Optional] access Account alias (default: "default")',
            type: String,
          },
          {
            name: "serviceName",
            description:
              '[Optional] deploy ServiceName (default: "serviceless-cd")',
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
    boolean: ["help"],
    string: ["access", "serviceName"],
    alias: { access: "a" },
  });
  const { data } = parsedArgs;
  return {
    access: data?.access || "default",
    serviceName: data?.serviceName || "serverless-cd",
  };
};

export default {
  dev: async (inputs) => {
    await checkEnv(inputs);
    await replaceTemplateWithEnv(inputs);
  },
  hasCommandHelp,
};
