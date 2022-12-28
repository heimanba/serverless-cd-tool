import {
  lodash as _,
  help,
  commandParse,
  downloadRequest,
  request,
  rimraf,
  getRootHome,
  fse,
} from "@serverless-devs/core";
import { promisify } from "util";
import logger from "../common/logger";
import path from "path";
import { hasHelpOptions, getSrcPath } from "../util";
import { IInput } from "../common/entity";

const hasCommandHelp = (inputs: IInput) => {
  const isHelp = hasHelpOptions(inputs);
  if (isHelp) {
    help([
      {
        header: "Usage",
        content: "$ s cli serverless-cd-tool update [options]",
      },
      {
        header: "Options",
        optionList: [
          {
            name: "list",
            description:
              '[Optional] list available service (default: "default")',
            type: String,
          },
          {
            name: "service",
            description: `[Optional] service name to update
              Run " s cli serverless-cd-tool update --list " show services
              Update all services: " s cli serverless-cd-tool update "
              Update one service: " s cli serverless-cd-tool update --service master"
              Update multiple services: " s cli serverless-cd-tool update --service master,worker"`,
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
    boolean: ["help", "list"],
    string: ["access", "service"],
    alias: { access: "a" },
  });
  const { data } = parsedArgs;
  return {
    access: data?.access || "default",
    serviceName: data?.service,
    list: data?.list,
  };
};

const updateOneService = async (inputs, serviceName: string) => {
  const rootPath = path.join(getRootHome(), "cache", "serevrless-cd");
  /**
   * 先删除再下载并解压
   * 目录地址为 ～/.s/cache/serverless-cd
   */
  await promisify(rimraf)(rootPath);
  await fse.ensureDir(rootPath);
  const URL_PREFIX = "https://registry.devsapp.cn/simple/devsapp/serverless-cd";
  const result = await request(`${URL_PREFIX}/releases/latest`);
  const latestVersion = result.tag_name;
  const url = `${URL_PREFIX}/zipball/${latestVersion}`;
  const filename = "serverless-cd.zip";
  await downloadRequest(url, rootPath, {
    filename,
    extract: true,
    strip: 1,
  });

  const srcPath = await getSrcPath(inputs);
  if (serviceName) {
    const servicePath = path.join(srcPath, serviceName);
    await promisify(rimraf)(servicePath);
    await fse.move(path.join(rootPath, "src", serviceName), servicePath);
    logger.info(`${serviceName} update Success！`);
  }
};

const update = async (inputs: IInput) => {
  const inputOptions = getInputCommandOptions(inputs);
  logger.debug(`input options: ${JSON.stringify(inputOptions)}`);
  const serviceMap = {
    master: ["master"],
    worker: ["worker", "worker-deliver", "workerDeliver"],
    admin: ["admin"],
  };
  let services = [];
  const serviceMapNames = _.keys(serviceMap);
  if (inputOptions.list) {
    return logger.output(serviceMapNames);
  }

  // 更新所有
  if (!inputOptions.serviceName) {
    services = serviceMapNames;
  } else {
    const serviceNames = _.map(_.split(inputOptions.serviceName, ","), (item) =>
      _.trim(item)
    );
    _.each(serviceMap, (item, key) => {
      _.each(serviceNames, (serviceName) => {
        if (_.includes(item, serviceName)) {
          services.push(key);
        }
      });
    });
    services = _.uniq(services);
  }

  if (_.isEmpty(services)) {
    return logger.warn(
      'Not found service to update, please try "s cli serverless-cd-tool update " '
    );
  }
  for (const serviceName of services) {
    await updateOneService(inputs, serviceName);
  }
};

export default {
  hasCommandHelp,
  update,
};
