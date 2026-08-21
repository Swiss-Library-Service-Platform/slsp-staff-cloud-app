export type UserType = 'staff' | 'eduid';

export interface LinkDetail {
	linkedTo: string;
	isAtam: boolean;
	displayName?: string;
	isEnabled: boolean;
	isActive: boolean;
	startDate: string | null;
	endDate: string | null;
}

export interface LinkUser {
	primaryId: string;
	fullName: string;
	firstName?: string;
	lastName?: string;
	userType: UserType;
	isLinked?: boolean;
	linkedTo?: string[];
	linkCount?: number;
	hasActiveLink?: boolean;
	linkDetails?: LinkDetail[];
	emails?: string[];
	isAtam?: boolean;
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
	startDate: string | null;
	endDate: string | null;
	isActive: boolean;
	createdAt: string;
}

export interface StaffUserGroup {
	almaPrimaryId: string;
	givenName: string;
	surname: string;
	isAtam: boolean;
	libraryCodes: string[];
	eduIdLinks: EduIdLink[];
}
