import React from "react";
import { waitFor, getByTestId } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { render } from "@c11/engine.react";
import { viewSelector } from "../src";
import { engine } from "@c11/engine.runtime";

const flushPromises = () => {
  return new Promise(setImmediate);
};

jest.useFakeTimers("legacy");

// @ts-ignore

beforeEach(() => {
  document.body.innerHTML = "";
});

test("should support viewSelector() with a single hierarchy", async (done) => {
  const rootEl = document.createElement("div");
  rootEl.setAttribute("id", "root");
  document.body.appendChild(rootEl);

  enum Ids {
    A = "a",
  }

  const A: view = () => <div data-testid={Ids.A}>{Ids.A}</div>;

  const selector = (data) => {
    return Ids.A;
  };

  const Component = viewSelector(
    {
      [Ids.A]: A,
    },
    selector
  );

  const app = engine({
    use: [render(<Component />, rootEl)],
  });

  app.start();

  jest.runAllTimers();
  await flushPromises();
  waitFor(() => getByTestId(document.body, Ids.A)).then(async (x) => {
    expect(x.innerHTML).toBe(Ids.A);
    done();
  });
});
