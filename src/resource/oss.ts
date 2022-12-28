import OSS from "ali-oss";
import { IProps } from "../common/entity";

export default class Oss {
  client: OSS;
  bucketName: string;

  constructor(envConfig: IProps) {
    this.client = new OSS({
      region: `oss-${envConfig.REGION}`,
      accessKeyId: envConfig.ACCESS_KEY_ID,
      accessKeySecret: envConfig.ACCESS_KEY_SECRET,
    });
    this.bucketName = `${envConfig.ACCOUNTID}-${envConfig.REGION}-serverless-cd`;
  }

  // 创建存储空间。
  async putBucket() {
    try {
      const options = {
        storageClass: "Standard", // 存储空间的默认存储类型为标准存储，即Standard。如果需要设置存储空间的存储类型为归档存储，请替换为Archive。
        acl: "private", // 存储空间的默认读写权限为私有，即private。如果需要设置存储空间的读写权限为公共读，请替换为public-read。
        dataRedundancyType: "LRS", // 存储空间的默认数据容灾类型为本地冗余存储，即LRS。如果需要设置数据容灾类型为同城冗余存储，请替换为ZRS。
      };
      await this.client.putBucket(this.bucketName, options);
    } catch (err) {
      throw err;
    }
  }
  
  async handleDel(name) {
    try {
      await this.client.delete(name);
    } catch (error) {
      error.failObjectName = name;
      return error;
    }
  }

  async deletePrefix(prefix) {
    this.client.useBucket(this.bucketName);
    const list = await this.client.list({
      prefix,
    });
    list.objects = list.objects || [];
    await Promise.all(
      list.objects.map((v) => this.handleDel(v.name))
    );
  }
}
