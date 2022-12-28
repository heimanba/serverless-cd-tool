import { lodash as _, fse } from "@serverless-devs/core";
import path from "path";
import logger from "./common/logger";
import { IInput } from "./common/entity";
import { getSrcPath } from "./util";
import Ots from "./resource/tablestore";
import generateService from "./service/generate";
import devService from "./service/dev";
import removeService from "./service/remove";
import updateService from "./service/update";

export default class SevrerlessCdTool {
  /**
   * 云资源创建
   * @param inputs
   * @returns
   */
  public async generate(inputs: IInput) {
    logger.debug(`input: ${JSON.stringify(inputs.props)}`);
    const hasHelp = generateService.hasCommandHelp(inputs);
    if (hasHelp) {
      return;
    }

    const srcPath = await getSrcPath(inputs);
    const envFilePath = path.join(srcPath, ".env");
    const isOverWrite = await generateService.promptOverwriteEnv(envFilePath);
    if(!isOverWrite) {
      return;
    }
    const envConfig = await generateService.getDefaultEnvConfig(inputs);
    await generateService.generate(envConfig, inputs);
    let envStr = "";
    _.forEach(envConfig, (value, key) => (envStr += `${key}=${value || ""}\n`));
    fse.outputFileSync(envFilePath, envStr);
  }

  /**
   * 本地Dev开发
   * @param inputs
   */
  public async dev(inputs: IInput) {
    logger.debug(`input: ${JSON.stringify(inputs.props)}`);
    const hasHelp = devService.hasCommandHelp(inputs);
    if (hasHelp) {
      return;
    }
    await devService.dev(inputs);
    logger.info(
      "s.dev.yaml 配置成功，请执行 s deploy -t s.dev.yaml 进行应用部署"
    );
  }

  /**
   * 更新资源
   * @param inputs
   * @returns
   */
  public async update(inputs: IInput) {
    logger.debug(`input: ${JSON.stringify(inputs.props)}`);
    const hasHelp = updateService.hasCommandHelp(inputs);
    if (hasHelp) {
      return;
    }
    await updateService.update(inputs);
  }

  /**
   * 删除资源
   * @param inputs
   */
  public async remove(inputs: IInput) {
    // s remove
    await removeService.hasCommandHelp(inputs);
    
    await removeService.remove(inputs);
    // logger.info("Remove function resource success...");
  }
}

const OtsDemo = Ots;

export { OtsDemo };
