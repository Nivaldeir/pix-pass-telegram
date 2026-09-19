export type GrantAccessResult = {
  inviteLink: string;
};

export interface GroupAccessService {
  grantAccess(telegramUserId: number): Promise<GrantAccessResult>;
  revokeAccess(telegramUserId: number): Promise<void>;
}
