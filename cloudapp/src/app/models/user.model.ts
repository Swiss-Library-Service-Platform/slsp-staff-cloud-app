export type UserType = 'staff' | 'eduid';

export interface LinkUser {
	primaryId: string;
	fullName: string;
	firstName?: string;
	lastName?: string;
	userType: UserType;
	isLinked?: boolean;
	linkedTo?: string[];
	linkCount?: number;
	hasDisabledLinks?: boolean;
	emails?: string[];
}

export interface LinkSelection {
	staff: LinkUser | null;
	eduid: LinkUser | null;
}

export interface EduIdLink {
	linkId: number;
	eduIdPersonalId: string;
	eduIdGivenName?: string;
	eduIdSurname?: string;
	isEnabled: boolean;
	createdAt: string;
}

export interface StaffUserGroup {
	almaPrimaryId: string;
	givenName: string;
	surname: string;
	libraryCodes: string[];
	eduIdLinks: EduIdLink[];
}
