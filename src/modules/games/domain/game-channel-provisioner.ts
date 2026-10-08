export type ProvisionedGameChannel = {
  telegramGroupId: number;
  streamServerUrl: string;
  streamKey: string;
  accessHash: string;
};

export interface GameChannelProvisioner {
  provision(title: string): Promise<ProvisionedGameChannel>;
  deleteGroup(telegramGroupId: number, accessHash: string): Promise<void>;
}
