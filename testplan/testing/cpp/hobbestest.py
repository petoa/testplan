from testplan.common.config import ConfigOption

from testplan.report.testing import TestGroupReport, TestCaseReport
from testplan.testing.multitest.entries.assertions import RawAssertion
from testplan.testing.multitest.entries.schemas.base import registry

from ..base import ProcessRunnerTest, ProcessRunnerTestConfig

import os
import json

class HobbesTestConfig(ProcessRunnerTestConfig):
    """
    Configuration object for :py:class:`~testplan.testing.cpp.HobbesTest`.
    """
    @classmethod
    def get_options(cls):
        return {
            ConfigOption('tests', default=None): list,
            ConfigOption('json', default='report.json'): str,
            ConfigOption('other_args', default=[]): list,
        }


class HobbesTest(ProcessRunnerTest):
    """
    Subprocess test runner for Hobbes Test: https://github.com/Morgan-Stanley/hobbes

    :param tests: Run one or more specified test(s).
    :type tests: ``list``
    :param json: Generate test report in JSON with the specified name. The report will be
    placed under rundir unless user specifies an absolute path. The content of the report
    will be parsed to generate testplan report.
    :type json: ``str``
    :param other_args: Any other arguments to be passed to the test binary.
    :type other_args: ``list``

    Also inherits all
    :py:class:`~testplan.testing.base.ProcessTest` options.
    """

    CONFIG = HobbesTestConfig

    def __init__(self, **options):
        options['driver'] = os.path.abspath(options['driver'])
        # Change working directory to where the test binary is,
        # as it might look under current directory for other binaries.
        options['proc_cwd'] = os.path.dirname(options['driver'])
        super(HobbesTest, self).__init__(**options)

    def test_command(self):
        cmd = [self.cfg.driver] + ['--json', self.report_path]
        if self.cfg.tests:
            cmd.append('--tests')
            cmd += self.cfg.tests
        cmd += self.cfg.other_args
        return cmd

    def list_command(self):
        cmd = [self.cfg.driver, '--list']
        return cmd

    def read_test_data(self):
        with open(self.report_path) as report_file:
            return json.load(report_file)

    def process_test_data(self, test_data):
        """
        JSON output contains entries for skipped testcases
        as well, which are not included in the report.
        """

        result = []
        for suite in test_data:
            suite_report = TestGroupReport(
                name=suite['name'],
                category='suite',
            )
            suite_has_run = False

            for testcase in suite['data']:
                if testcase['status'] != 'skipped':
                    suite_has_run = True

                    testcase_report = TestCaseReport(name=testcase['name'])
                    assertion_obj = RawAssertion(
                        passed=testcase['status'] == 'pass',
                        content=testcase['error'] or testcase['duration'],
                        description=testcase['name']
                    )
                    testcase_report.append(registry.serialize(assertion_obj))
                    suite_report.append(testcase_report)

            if suite_has_run:
                result.append(suite_report)
        return result

    @property
    def report_path(self):
        if os.path.isabs(self.cfg.json):
            return self.cfg.json

        return os.path.join(self.runpath, self.cfg.json)

    def parse_test_context(self, test_list_output):
        """
        Parse test binary --list_tests output. This is used when we
        run test_plan.py with --list/--info option.
        """
        # Sample command line output:
        #
        # MyHobbesTest
        #   Arrays
        #   Compiler
        #   Definitions
        #
        #
        # Sample Result:
        #
        # [
        #     ['Arrays', []],
        #     ['Compiler', []]
        #     ['Definitions', []]
        # ]
        result = [[line.strip(), []] for line in test_list_output.splitlines()]
        return result