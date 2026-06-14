import { CRUD_ACTIONS, matrixRows, permissionKey } from "./userMgmtUtils.js";

export function PermissionMatrix({ draft, onToggle, onToggleResource, disabled = false }) {
  return (
    <div className="user-mgmt-matrix">
      <table>
        <thead>
          <tr>
            <th scope="col">Resource</th>
            {CRUD_ACTIONS.map((action) => (
              <th key={action} scope="col">
                {action}
              </th>
            ))}
            <th scope="col">All</th>
          </tr>
        </thead>
        <tbody>
          {matrixRows().map((row) => {
            if (row.kind === "group") {
              return (
                <tr key={row.id} className="user-mgmt-matrix__group">
                  <td colSpan={CRUD_ACTIONS.length + 2}>{row.label}</td>
                </tr>
              );
            }

            const resourceActions = CRUD_ACTIONS.map((action) => permissionKey(row.id, action));
            const allChecked = resourceActions.every((key) => draft.includes(key));
            const someChecked = resourceActions.some((key) => draft.includes(key));

            return (
              <tr key={row.id} className="user-mgmt-matrix__row">
                <td>{row.label}</td>
                {CRUD_ACTIONS.map((action) => {
                  const key = permissionKey(row.id, action);
                  return (
                    <td key={key}>
                      <input
                        type="checkbox"
                        aria-label={`${row.label} ${action}`}
                        checked={draft.includes(key)}
                        disabled={disabled}
                        onChange={() => onToggle(key)}
                      />
                    </td>
                  );
                })}
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${row.label} full access`}
                    checked={allChecked}
                    disabled={disabled}
                    ref={(node) => {
                      if (node) node.indeterminate = !allChecked && someChecked;
                    }}
                    onChange={() => onToggleResource(row.id, !allChecked)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
