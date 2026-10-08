export type GrantAccessResult = {
  inviteLink: string;
};

export interface GroupAccessService {
  grantAccess(telegramUserId: number, telegramGroupId?: number): Promise<GrantAccessResult>;
  revokeAccess(telegramUserId: number): Promise<void>;
}
