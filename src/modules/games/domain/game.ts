export type Game = {
  id: string;
  title: string;
  startsAt?: Date;
  amountCents: number;
  telegramGroupId: number;
  streamServerUrl?: string;
  streamKey?: string;
  telegramAccessHash?: string;
  autoCreatedGroup: boolean;
  deleteAt?: Date;
  groupDeletedAt?: Date;
  homeLogoUrl?: string;
  awayLogoUrl?: string;
  isActive: boolean;
  createdAt: Date;
};
