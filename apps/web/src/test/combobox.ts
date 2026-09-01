import { screen, within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

type User = ReturnType<typeof userEvent.setup>;

/**
 * What one `SuggestCombobox` offers, in the order it offers it.
 *
 * The list is the component's own rather than a `<datalist>` the browser owns, so reading it means
 * opening it. Closed again afterwards, so a test may ask twice without the second call toggling
 * the list shut instead of open.
 */
export async function suggestionsFor(user: User, label: string): Promise<string[]> {
  const toggle = screen.getByLabelText(`Show ${label} suggestions`);
  await user.click(toggle);
  const names = within(screen.getByRole("listbox", { name: `${label} suggestions` }))
    .queryAllByRole("option")
    .map((option) => option.querySelector(".combo-name")?.textContent ?? "");
  await user.click(toggle);
  return names;
}

/** One `SearchPicker` row, as the two columns it draws. */
export interface PickerRow {
  name: string;
  note: string;
}

/** Opens a `SearchPicker` and reads what it offers under `query`, headings and rows in order. */
export async function searchPicker(
  user: User,
  label: string,
  query = ""
): Promise<{ headings: string[]; rows: PickerRow[]; footer: string[] }> {
  // Escape first, so a picker already searched or already open starts from rest — and so a picker
  // that holds a value is read with that value showing, not with the box cleared out from under it.
  await user.type(screen.getByLabelText(label), "{Escape}");
  if (query === "") {
    await user.click(screen.getByLabelText(`Show ${label} suggestions`));
  } else {
    await user.clear(screen.getByLabelText(label));
    await user.type(screen.getByLabelText(label), query);
  }
  const list = screen.getByRole("listbox", { name: `${label} suggestions` });
  return {
    headings: [...list.querySelectorAll(".combo-group")].map((row) => row.textContent ?? ""),
    rows: [...list.querySelectorAll(".combo-option")].map((row) => ({
      name: row.querySelector(".combo-name")?.textContent ?? "",
      note: row.querySelector(".combo-count")?.textContent ?? "",
    })),
    footer: [...list.querySelectorAll(".combo-empty")].map((row) => row.textContent ?? ""),
  };
}

/** Picks one `SearchPicker` row, narrowing to it first the way a user reaching for it would. */
export async function pickFromSearch(user: User, label: string, value: string) {
  await user.type(screen.getByLabelText(label), "{Escape}");
  await user.clear(screen.getByLabelText(label));
  await user.type(screen.getByLabelText(label), value);
  const row = within(screen.getByRole("listbox", { name: `${label} suggestions` }))
    .getAllByRole("option")
    .find((option) => option.querySelector(".combo-name")?.textContent === value);
  if (!row) throw new Error(`"${label}" offers no row called ${value}`);
  await user.click(row);
}

/** Replaces what a combobox holds — the box takes free text, so a change is a retype. */
export async function retype(user: User, label: string, value: string) {
  const box = screen.getByLabelText(label);
  await user.clear(box);
  if (value !== "") await user.type(box, value);
}
