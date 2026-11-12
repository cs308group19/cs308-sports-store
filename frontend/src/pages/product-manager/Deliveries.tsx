import { DashboardShell } from "../../components/layout/DashboardShell";

export function Deliveries({ notify }: { notify: (s: string) => void }) {
  const deliveries = [
    [
      "DLV-81142",
      "CUS-1042",
      "RLY-P-0003",
      "1",
      "$99.00",
      "123 Fast Lane, Istanbul",
      "No",
      "Processing",
    ],
    [
      "DLV-81102",
      "CUS-0921",
      "RLY-P-0001",
      "2",
      "$258.00",
      "8 Park Ave, Ankara",
      "No",
      "In transit",
    ],
    [
      "DLV-81087",
      "CUS-0874",
      "RLY-P-0005",
      "1",
      "$39.00",
      "44 Coast Rd, Izmir",
      "Yes",
      "Delivered",
    ],
    [
      "DLV-81055",
      "CUS-0740",
      "RLY-P-0002",
      "1",
      "$145.00",
      "19 Hill St, Bursa",
      "No",
      "Processing",
    ],
  ];
  return (
    <DashboardShell eyebrow="Fulfillment" title="Deliveries">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Delivery ID</th>
              <th>Customer ID</th>
              <th>Product ID</th>
              <th>Quantity</th>
              <th>Total price</th>
              <th>Delivery address</th>
              <th>Completed</th>
              <th>Status update</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d[0]}>
                <td>
                  <b>{d[0]}</b>
                </td>
                <td>{d[1]}</td>
                <td>{d[2]}</td>
                <td>{d[3]}</td>
                <td>{d[4]}</td>
                <td>{d[5]}</td>
                <td>
                  <span className={`status ${d[6] === "Yes" ? "green" : "orange-status"}`}>
                    {d[6]}
                  </span>
                </td>
                <td>
                  <select defaultValue={d[7]} onChange={() => notify(`${d[0]} status updated`)}>
                    <option>Processing</option>
                    <option>In transit</option>
                    <option>Delivered</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
