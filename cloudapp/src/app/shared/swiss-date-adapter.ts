import { NativeDateAdapter, MatDateFormats } from '@angular/material/core';

/**
 * Date adapter that displays dates as DD.MM.YYYY (Swiss numeric format),
 * independent of the active UI language. Only the input-field rendering is
 * overridden; the calendar popup keeps the locale provided by Material.
 * The inputs that use this adapter are readonly (calendar-only), so no manual
 * string parsing is needed.
 */
export class SwissDateAdapter extends NativeDateAdapter {
	public override format(date: Date, displayFormat: object): string {
		// Only the input field uses DD.MM.YYYY; calendar header and a11y
		// labels keep their locale-aware rendering via the parent adapter.
		if (displayFormat === SWISS_DATE_FORMATS.display.dateInput) {
			const day = String(date.getDate()).padStart(2, '0');
			const month = String(date.getMonth() + 1).padStart(2, '0');

			return `${day}.${month}.${date.getFullYear()}`;
		}

		return super.format(date, displayFormat);
	}
}

export const SWISS_DATE_FORMATS: MatDateFormats = {
	parse: {
		dateInput: 'DD.MM.YYYY',
	},
	display: {
		dateInput: 'DD.MM.YYYY',
		monthYearLabel: { year: 'numeric', month: 'short' },
		dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
		monthYearA11yLabel: { year: 'numeric', month: 'long' },
	},
};
