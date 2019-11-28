/* Tests the InteractiveReport component. */
import React from 'react';
import {shallow} from 'enzyme';
import {StyleSheetTestUtils} from "aphrodite";
import moxios from 'moxios';

import InteractiveReport from '../InteractiveReport.js';
import {FakeInteractiveReport} from '../../Common/sampleReports.js';
import {ReportToNavEntry} from '../../Common/utils.js';

const INITIAL_REPORT = {
  "uid": "TestplanUID",
  "timer": {},
  "status": "ready",
  "meta": {},
  "status_override": null,
  "attachments": {},
  "tags_index": {},
  "name": "TestplanName",
  "parent_uids": [],
  "type": "TestGroupReport",
  "category": "testplan",
  "entries": [{
    "uid": "MultiTestUID",
    "timer": {},
    "description": null,
    "tags": {},
    "status": "ready",
    "part": null,
    "status_override": null,
    "category": "multitest",
    "name": "MultiTestName",
    "fix_spec_path": null,
    "parent_uids": ["TestplanUID"],
    "type": "TestGroupReport",
    "category": "multitest",
    "entries": [{
      "uid": "SuiteUID",
      "timer": {},
      "description": null,
      "tags": {},
      "status": "ready",
      "part": null,
      "status_override": null,
      "category": "suite",
      "name": "SuiteName",
      "fix_spec_path": null,
      "parent_uids": ["TestplanUID", "MultiTestUID"],
      "type": "TestGroupReport",
      "category": "suite",
      "entries": [{
        "uid": "testcaseUID",
        "timer": {},
        "description": null,
        "tags": {},
        "type": "TestCaseReport",
        "status": "ready",
        "logs": [],
        "suite_related": false,
        "entries": [],
        "status_override": null,
        "name": "testcaseName",
        "type": "TestCaseReport",
        "parent_uids": [
          "TestplanUID", "MultiTestUID", "SuiteUID",
        ],
      }],
    }],
  }],
};


describe('InteractiveReport', () => {
  beforeEach(() => {
    // Stop Aphrodite from injecting styles, this crashes the tests.
    StyleSheetTestUtils.suppressStyleInjection();
    moxios.install();
  });

  afterEach(() => {
    // Resume style injection once test is finished.
    StyleSheetTestUtils.clearBufferAndResumeStyleInjection();
    moxios.uninstall();
  });

  it("Loads report skeleton when mounted", done => {
    const interactiveReport = shallow(<InteractiveReport />);
    moxios.wait(() => {
      const request = moxios.requests.mostRecent();
      expect(request.url).toBe("/api/v1/interactive/report");
      request.respondWith({
        status: 200,
        response: {
          "uid": "TestplanUID",
          "timer": {},
          "status": "ready",
          "meta": {},
          "entry_uids": [
            "MultiTestUID"
          ],
          "parent_uids": [],
          "status_override": null,
          "attachments": {},
          "tags_index": {},
          "name": "TestplanUID"
        },
      }).then(() => {
        moxios.wait(() => {
          const request = moxios.requests.mostRecent();
          expect(request.url).toBe("/api/v1/interactive/report/tests");
          request.respondWith({
            status: 200,
            response: [
              {
                "uid": "MultiTestUID",
                "timer": {},
                "description": null,
                "tags": {},
                "status": "ready",
                "part": null,
                "status_override": null,
                "category": "multitest",
                "entry_uids": [
                  "SuiteUID"
                ],
                "parent_uids": ["TestplanUID"],
                "name": "MultiTestUID",
                "fix_spec_path": null
              }
            ]
          }).then(() => {
            moxios.wait(() => {
              const request = moxios.requests.mostRecent();
              expect(request.url).toBe(
                "/api/v1/interactive/report/tests/MultiTestUID/suites"
              );
              request.respondWith({
                status: 200,
                response: [{
                  "uid": "SuiteUID",
                  "timer": {},
                  "description": null,
                  "tags": {},
                  "status": "ready",
                  "part": null,
                  "status_override": null,
                  "category": "suite",
                  "entry_uids": [
                    "testcaseUID",
                  ],
                  "parent_uids": ["TestplanUID", "MultiTestUID"],
                  "name": "SuiteUID",
                  "fix_spec_path": null
                }]
              }).then(() => {
                moxios.wait(() => {
                  const request = moxios.requests.mostRecent();
                  expect(request.url).toBe(
                    "/api/v1/interactive/report/tests/MultiTestUID"
                    + "/suites/SuiteUID/testcases"
                  );
                  request.respondWith({
                    status: 200,
                    response: [{
                      "uid": "testcaseUID",
                      "timer": {},
                      "description": null,
                      "tags": {},
                      "type": "TestCaseReport",
                      "status": "ready",
                      "logs": [],
                      "suite_related": false,
                      "entries": [],
                      "status_override": null,
                      "name": "testcaseUID",
                      "parent_uids": [
                        "TestplanUID", "MultiTestUID", "SuiteUID",
                      ],
                    }]
                  }).then(() => {
                    expect(interactiveReport).toMatchSnapshot();
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  it("handles navigation entries being clicked", () => {
    const interactiveReport = shallow(<InteractiveReport />);
    interactiveReport.setState({
      report: INITIAL_REPORT,
      selected: interactiveReport.instance().autoSelect(INITIAL_REPORT),
    });
    interactiveReport.update();
    expect(interactiveReport.state("selected")).toStrictEqual([
      {uid: "TestplanUID", type: "testplan"}
    ]);

    const mockEvent = {stopPropagation: jest.fn()};
    interactiveReport.instance().handleNavClick(
      mockEvent,
      {uid: "MultiTestUID", type: "TestGroupReport", category: "multitest"},
      1,
    );
    interactiveReport.update();

    expect(interactiveReport.state("selected")).toStrictEqual([
      {uid: "TestplanUID", type: "testplan"},
      {uid: "MultiTestUID", type: "multitest"},
    ]);
    expect(interactiveReport).toMatchSnapshot();
  });

  const testRunEntry = (done, clickedEntry, expectedURL) => {
    const interactiveReport = shallow(<InteractiveReport />);
    interactiveReport.setState({
      report: INITIAL_REPORT,
      selected: interactiveReport.instance().autoSelect(INITIAL_REPORT),
    });
    interactiveReport.update();

    const mockEvent = {stopPropagation: jest.fn()};
    interactiveReport.instance().handlePlayClick(mockEvent, clickedEntry);

    moxios.wait(() => {
      const request = moxios.requests.mostRecent();
      expect(request.url).toBe(expectedURL);
      expect(request.config.method).toBe("put");
      const putData = JSON.parse(request.config.data);
      expect(putData.uid).toBe(clickedEntry.uid);
      expect(putData.status).toBe("running");

      request.respondWith({
        status: 200,
        response: putData,
      }).then(() => {
        expect(interactiveReport).toMatchSnapshot();
        done();
      });
    });
  };

  it("handles tests being run", done => testRunEntry(
    done,
    {uid: "MultiTestUID", parent_uids: ["TestplanUID"]},
    "/api/v1/interactive/report/tests/MultiTestUID",
  ));

  it("handles individual test suites being run", done => testRunEntry(
    done,
    {
      uid: "SuiteUID",
      parent_uids: ["TestplanUID", "MultiTestUID"],
    },
    "/api/v1/interactive/report/tests/MultiTestUID/suites/SuiteUID",
  ));

  it("handles individual testcases being run", done => testRunEntry(
    done,
    {
      uid: "testcaseUID",
      parent_uids: ["TestplanUID", "MultiTestUID", "SuiteUID"],
    },
    "/api/v1/interactive/report/tests/MultiTestUID/suites/SuiteUID"
    + "/testcases/testcaseUID",
  ));

});

