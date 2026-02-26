import {
	provideHttpClient,
	withInterceptorsFromDi,
} from '@angular/common/http';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {
	AlertModule,
	CloudAppTranslateModule,
	InitService,
	MaterialModule,
} from '@exlibris/exl-cloudapp-angular-lib';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AuthGuardComponent } from './auth/auth-guard.component';
import { SharedModule } from './shared/shared.module';
import { ShellComponent } from './shell/shell.component';
import { LinkAccountsComponent } from './tabs/link-accounts/link-accounts.component';
import { ListUsersComponent } from './tabs/list-users/list-users.component';
import { GroupsComponent } from './tabs/groups/groups.component';

@NgModule({
	declarations: [
		AppComponent,
		ShellComponent,
		LinkAccountsComponent,
		ListUsersComponent,
		GroupsComponent,
	],
	bootstrap: [AppComponent],
	imports: [
		MaterialModule,
		BrowserModule,
		BrowserAnimationsModule,
		AppRoutingModule,
		AlertModule,
		FormsModule,
		ReactiveFormsModule,
		CloudAppTranslateModule.forRoot(),
		SharedModule,
		AuthGuardComponent,
	],
	providers: [
		{
			provide: APP_INITIALIZER,
			useFactory: (): (() => boolean) => () => true,
			deps: [InitService],
			multi: true,
		},
		{
			provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
			useValue: { appearance: 'fill' },
		},
		provideHttpClient(withInterceptorsFromDi()),
	],
})
export class AppModule {}
