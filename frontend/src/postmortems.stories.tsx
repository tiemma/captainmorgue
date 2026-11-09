import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Postmortems } from "./postmortems";
import { SAMPLE_POSTMORTEMS } from "./postmortems-fixtures";
import "./tokens.css";
import "./styles.css";

const meta = {
  title: "Screens/Postmortems",
  component: Postmortems,
  parameters: { layout: "fullscreen" },
  args: { documents: SAMPLE_POSTMORTEMS },
  decorators: [
    (Story) => (
      <div className="cm-app">
        <main className="cm-page">
          <p className="cm-eyebrow">Design preview / sample postmortems</p>
          <Story />
        </main>
      </div>
    ),
  ],
} satisfies Meta<typeof Postmortems>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Library: Story = {};
export const Empty: Story = { args: { documents: [] } };
export const Loading: Story = { args: { documents: [], loading: true } };

function RecoverableUnavailable() {
  const [unavailable, setUnavailable] = useState(true);
  return (
    <Postmortems
      documents={unavailable ? [] : SAMPLE_POSTMORTEMS}
      error={
        unavailable ? "The incident archive could not be loaded." : undefined
      }
      onRetry={() => setUnavailable(false)}
    />
  );
}

export const Unavailable: Story = {
  args: { documents: [], error: "The incident archive could not be loaded." },
  render: () => <RecoverableUnavailable />,
};
