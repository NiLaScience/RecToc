#!/usr/bin/env python3

"""
improved_job_application.py

An improved script that uses the 'browser_use' library to fill out a job application on any given job posting URL.
It follows a more iterative and structured approach:

1. Repeatedly query get_unfilled_required_fields to find all required fields.
2. Fill each field in order (top-to-bottom).
3. After each field fill or dropdown selection, call track_form_changes to see if new fields appear.
4. If all required fields are filled, attempt to submit.

It also includes custom fallback logic for advanced JS dropdowns and a robust approach to file upload.

Additionally, we now support job boards that require login (like LinkedIn, Indeed, etc.):
- We hold login credentials in a JSON dictionary or environment variable.
- The agent can call an action "get_site_login_credentials(site_name)" to retrieve them.
- The agent can then call "perform_login_flow(site_name)" to fill the login form fields.
- We store these credentials in a sensitive dictionary so it doesn't appear in the model's context.
"""

import argparse
import asyncio
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional, List

from dotenv import load_dotenv
from pydantic import BaseModel
from langchain_openai import ChatOpenAI

# If 'browser-use' isn't in your system path, adjust import as needed:
# sys.path.append("/path/to/browser-use/")

from browser_use import (
    Agent,
    ActionResult
)
from browser_use.browser.browser import Browser, BrowserConfig
from browser_use.browser.context import BrowserContext, BrowserContextConfig
from browser_use.controller.service import Controller

############################################
# Logging setup
############################################

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)-8s [%(name)s] %(message)s"
)

############################################
# Candidate Data Model
############################################

class CandidateProfile(BaseModel):
    name: str
    email: str
    phone: str
    address: Optional[str] = None
    resume_file_path: Optional[str] = None
    summary: Optional[str] = None
    work_experiences: Optional[list] = None
    education: Optional[list] = None
    skills: Optional[list] = None
    additional_info: Optional[str] = None

############################################
# Login credentials structure
############################################
# For demonstration, you might have a JSON object like:
# {
#   "linkedin": {
#       "username": "myLinkedInUser",
#       "password": "myLinkedInPass"
#   },
#   "indeed": {
#       "username": "myIndeedUser",
#       "password": "myIndeedPass"
#   },
#   ...
# }
# We store it in code here for demonstration. In practice, load from a separate JSON or env.

login_credentials_data: Dict[str, Dict[str, str]] = {}

############################################
# Controller and Custom Actions
############################################

controller = Controller()

# We store a global dictionary of candidate data so the agent can call `get_candidate_profile`
candidate_global_data: Dict[str, Any] = {}


@controller.registry.action("Get candidate profile")
def get_candidate_profile() -> dict:
    """
    Provide the candidate profile in dictionary form.
    Allows the agent to see all candidate data (name, email, phone, etc.).
    """
    logger.info("Agent requested the candidate profile.")
    return ActionResult(
        extracted_content=json.dumps(candidate_global_data),
        include_in_memory=True
    )

##########################################################
# Retrieve site login credentials from memory (sensitive)
##########################################################

@controller.registry.action("get_site_login_credentials")
def get_site_login_credentials(site_name: str) -> dict:
    """
    Provide login credentials for a site from our sensitive data.
    The agent calls this to get the placeholder (not actual secrets) if we want
    to hide the real password from the model. 
    But for demonstration, we do the direct dictionary approach.

    If the site isn't recognized, return an error.
    """
    # Make case-insensitive comparison by converting everything to lowercase
    site_name_lower = site_name.strip().lower()
    # Create a case-insensitive lookup dictionary
    credentials_lower = {k.lower(): v for k, v in login_credentials_data.items()}
    
    if site_name_lower in credentials_lower:
        creds = credentials_lower[site_name_lower]
        extracted = {
            "username": creds.get("username", ""),
            "password": creds.get("password", "")
        }
        return ActionResult(
            extracted_content=json.dumps(extracted),
            include_in_memory=False
        )
    else:
        msg = f"No login credentials found for site '{site_name}' (available sites: {list(login_credentials_data.keys())})"
        logger.info(msg)
        return ActionResult(error=msg)

##########################################################
# Perform a typical login flow
##########################################################

@controller.registry.action("perform_login_flow")
async def perform_login_flow(site_name: str, browser: BrowserContext) -> ActionResult:
    """
    Attempt to log in to the specified site using the credentials.
    You might tailor this to known selectors for each job board (LinkedIn, Indeed, etc.).
    The agent can choose to call 'perform_login_flow' once it identifies 
    that the website is LinkedIn or Indeed or something that requires login.
    """
    site_name_lower = site_name.lower().strip()

    # Retrieve the credentials by calling "get_site_login_credentials"
    # Because this is an action, the agent might do it, but let's do it ourselves for demonstration:
    creds_result = get_site_login_credentials(site_name_lower)
    if creds_result.error:
        return creds_result  # pass that error up

    try:
        creds = json.loads(creds_result.extracted_content)
    except:
        msg = f"Failed to parse credentials for site {site_name_lower}."
        logger.info(msg)
        return ActionResult(error=msg)

    username = creds.get("username", "")
    password = creds.get("password", "")
    if not username or not password:
        msg = f"Credentials incomplete for site {site_name_lower}"
        logger.info(msg)
        return ActionResult(error=msg)

    logger.info(f"Attempting to login to {site_name_lower} with user '{username}'")

    page = await browser.get_current_page()

    # Depending on the known site, we do a site-specific approach:
    if site_name_lower == "linkedin":
        # For example:
        # 1) Go to https://www.linkedin.com/login if not already there
        # 2) fill in the username, password, 3) press "Sign in"
        # This is just a demonstration. You might have a dynamic approach or rely on the agent to navigate.

        try:
            current_url = page.url
            if "linkedin.com" not in current_url:
                await page.goto("https://www.linkedin.com/login")
            await page.wait_for_load_state()

            # type username
            username_sel = 'input#username'
            password_sel = 'input#password'
            sign_in_btn_sel = 'button[type="submit"]'

            await page.fill(username_sel, username)
            await asyncio.sleep(0.5)
            await page.fill(password_sel, password)
            await asyncio.sleep(0.5)
            await page.click(sign_in_btn_sel)
            logger.info("Clicked sign in on LinkedIn.")
            await asyncio.sleep(3)

            # check if login succeeded
            # If there's an error or something, we'd handle it. 
            # We'll skip that for brevity.
            msg = f"Login attempt complete for LinkedIn user {username}"
            logger.info(msg)
            return ActionResult(extracted_content=msg, include_in_memory=True)

        except Exception as e:
            msg = f"Failed LinkedIn login flow: {str(e)}"
            logger.info(msg)
            return ActionResult(error=msg)

    elif site_name_lower == "indeed":
        # Similarly, you'd go to https://secure.indeed.com/account/login
        # fill the fields, etc.
        try:
            if "indeed.com" not in page.url.lower():
                await page.goto("https://secure.indeed.com/account/login")
            await page.wait_for_load_state()

            username_sel = 'input#login-email-input'
            password_sel = 'input#login-password-input'
            sign_in_btn_sel = 'button[data-testid="login-submit-button"]'

            await page.fill(username_sel, username)
            await asyncio.sleep(0.5)
            await page.fill(password_sel, password)
            await asyncio.sleep(0.5)
            await page.click(sign_in_btn_sel)
            logger.info("Clicked sign in on Indeed.")
            await asyncio.sleep(3)

            msg = f"Login attempt complete for Indeed user {username}"
            logger.info(msg)
            return ActionResult(extracted_content=msg, include_in_memory=True)

        except Exception as e:
            msg = f"Failed Indeed login flow: {str(e)}"
            logger.info(msg)
            return ActionResult(error=msg)

    else:
        msg = f"No specialized login flow for site: {site_name_lower}"
        logger.info(msg)
        return ActionResult(error=msg)

############################################
# Additional actions for form filling
############################################

@controller.registry.action("Input text into form field with retries")
async def input_text_with_retry(
    index: int,
    text: str,
    browser: BrowserContext,
    max_retries: int = 3,
) -> ActionResult:
    """
    Repeatedly tries to fill a text input until verified or retries exhausted.
    Useful for dynamic fields that might vanish or appear slowly.
    """
    page = await browser.get_current_page()
    selector_map = await browser.get_selector_map()

    if index not in selector_map:
        msg = f"No element found at index {index}"
        logger.info(msg)
        return ActionResult(error=msg)

    dom_element = selector_map[index]

    for attempt in range(max_retries):
        try:
            # Attempt to locate the element
            element = await browser.get_locate_element(dom_element)
            if not element:
                if attempt == max_retries - 1:
                    msg = f"Could not locate text field at index {index}"
                    logger.info(msg)
                    return ActionResult(error=msg)
                else:
                    await asyncio.sleep(1)
                    continue

            # Clear existing text
            await element.evaluate("el => el.value = ''")
            await asyncio.sleep(0.2)

            # Type text slowly
            await element.type(text, delay=50)
            await asyncio.sleep(0.2)

            # Check if typed text matches
            typed_value = await element.evaluate("el => el.value")
            if typed_value.strip() == text.strip():
                msg = f"Successfully input '{text}' into field {index}"
                logger.info(msg)
                return ActionResult(extracted_content=msg, include_in_memory=True)
            else:
                logger.info(f"Verification mismatch. Attempt {attempt+1}/{max_retries} for index {index}")

        except Exception as e:
            logger.info(f"Failed attempt {attempt+1}/{max_retries} on index {index}: {str(e)}")
            if attempt == max_retries - 1:
                return ActionResult(error=str(e))
        await asyncio.sleep(1)

    msg = f"Unable to input '{text}' into field {index} after {max_retries} attempts"
    logger.info(msg)
    return ActionResult(error=msg)


@controller.registry.action("Upload resume file to element index")
async def upload_resume_file(index: int, browser: BrowserContext) -> ActionResult:
    """
    Attempt to upload the candidate's resume file (if available) to an <input type="file"> at highlight index.
    If that fails, tries a fallback approach scanning for any file input in the page or custom upload widgets.
    """
    resume_path = candidate_global_data.get("resume_file_path", None)
    if not resume_path:
        msg = "No resume_file_path in candidate data."
        logger.info(msg)
        return ActionResult(error=msg)

    full_path = Path(resume_path).expanduser().resolve()
    if not full_path.is_file():
        msg = f"Resume file not found at {full_path}"
        logger.info(msg)
        return ActionResult(error=msg)

    page = await browser.get_current_page()

    # Attempt standard approach: locate the specific highlight index
    dom_element = None
    selector_map = await browser.get_selector_map()
    if index in selector_map:
        dom_element = selector_map[index]
    else:
        logger.info(f"No element found at index {index}. Will fallback to scanning the page for file inputs.")
        dom_element = None

    # If we have a dom_element, attempt a direct approach:
    if dom_element:
        try:
            element_handle = await browser.get_locate_element(dom_element)
            if element_handle:
                await element_handle.set_input_files(str(full_path))
                msg = f"Successfully uploaded resume to element {index}"
                logger.info(msg)
                return ActionResult(extracted_content=msg, include_in_memory=True)
        except Exception as e:
            logger.info(f"Could not upload to index {index}: {str(e)}")

    # If direct approach fails, fallback to scanning the page for any file input
    try:
        file_inputs = await page.query_selector_all('input[type="file"]')
        if file_inputs:
            logger.info(f"Found {len(file_inputs)} <input type='file'> elements. Trying each.")
            for i, input_el in enumerate(file_inputs):
                try:
                    await input_el.set_input_files(str(full_path))
                    msg = f"Resume successfully uploaded to file input {i+1}"
                    logger.info(msg)
                    return ActionResult(extracted_content=msg, include_in_memory=True)
                except Exception as e:
                    logger.info(f"File input {i+1} upload attempt failed: {str(e)}")
    except Exception as e:
        logger.info(f"Scanning for standard file inputs failed: {str(e)}")

    msg = "Could not locate a valid file upload mechanism for the resume."
    logger.info(msg)
    return ActionResult(error=msg)


##################################################
# Custom select dropdown option for advanced JS
##################################################

@controller.registry.action("custom_select_dropdown_option")
async def custom_select_dropdown_option(index: int, text: str, browser: BrowserContext) -> ActionResult:
    """
    A fallback for advanced JS dropdowns. Tries to click the element, wait for
    a child node that matches 'text', and click that child. If it fails,
    tries typing 'text' + Enter. Also includes a keyboard navigation approach.
    """
    page = await browser.get_current_page()
    selector_map = await browser.get_selector_map()

    if index not in selector_map:
        return ActionResult(error=f"No element found at index {index}")

    dom_element = selector_map[index]

    # 1) Scroll into view
    try:
        await page.evaluate(
            """(xpath) => {
                const el = document.evaluate(
                    xpath, 
                    document, 
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                ).singleNodeValue;
                if (el) {
                    el.scrollIntoView({behavior: 'smooth', block: 'center'});
                }
            }""",
            dom_element.xpath
        )
        await asyncio.sleep(0.5)
    except Exception as e:
        logger.info(f"Scroll attempt failed for custom dropdown {index}: {str(e)}")

    # 2) Click the element to open dropdown
    element_handle = await browser.get_locate_element(dom_element)
    if not element_handle:
        return ActionResult(error=f"Could not locate element for custom dropdown at index {index}")

    try:
        await element_handle.click()
        await asyncio.sleep(1.0)
    except Exception as e:
        return ActionResult(error=f"Failed to click custom dropdown at index {index}: {str(e)}")

    # 3) Attempt keyboard navigation
    check_current_option_js = """() => {
        const getCurrentOption = () => {
            const selectors = [
                '[aria-selected="true"]',
                '[class*="selected"]',
                '[class*="highlighted"]',
                '[class*="active"]',
                ':focus'
            ];
            for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el && window.getComputedStyle(el).display !== 'none') {
                    return el.textContent.trim();
                }
            }
            return null;
        };
        return getCurrentOption();
    }"""
    try:
        # Click to ensure focus
        await element_handle.click()
        await asyncio.sleep(0.3)

        # Type partial text to narrow down
        first_chars = text[:3]
        await element_handle.type(first_chars, delay=50)
        await asyncio.sleep(0.5)

        max_attempts = 30
        for attempt in range(max_attempts):
            current_text = await page.evaluate(check_current_option_js)
            if current_text and text.lower() in current_text.lower():
                await page.keyboard.press("Enter")
                await asyncio.sleep(0.5)
                msg = f"Selected option '{text}' using keyboard nav after {attempt + 1} attempts"
                logger.info(msg)
                return ActionResult(extracted_content=msg, include_in_memory=True)

            if attempt < max_attempts / 2:
                await page.keyboard.press("ArrowDown")
            else:
                await page.keyboard.press("ArrowUp")
            await asyncio.sleep(0.1)
    except Exception as e:
        logger.info(f"Keyboard navigation failed: {str(e)}")

    # 4) Attempt scroll approach
    scroll_and_find_js = """async (text) => {
        const findDropdownContainer = () => {
            const selectors = [
                '.dropdown-menu:not([style*="display: none"])',
                '.select2-results__options',
                '.select2-dropdown',
                '[role="listbox"]',
                '[class*="dropdown"]:not([style*="display: none"])',
                '[class*="select-options"]:not([style*="display: none"])',
                '[class*="list-options"]:not([style*="display: none"])'
            ];
            
            for (const selector of selectors) {
                const container = document.querySelector(selector);
                if (container && window.getComputedStyle(container).display !== 'none') {
                    return container;
                }
            }
            return null;
        };

        const container = findDropdownContainer();
        if (!container) return false;

        const findOptionElement = () => {
            const selectors = [
                `li:not([style*="display: none"]):contains("${text}")`,
                `div:not([style*="display: none"]):contains("${text}")`,
                `span:not([style*="display: none"]):contains("${text}")`,
                `[role="option"]:contains("${text}")`,
                `[class*="option"]:contains("${text}")`
            ];
            for (const selector of selectors) {
                const elements = Array.from(container.querySelectorAll(selector));
                const visibleElement = elements.find(el => 
                    window.getComputedStyle(el).display !== 'none' &&
                    el.textContent.toLowerCase().includes(text.toLowerCase())
                );
                if (visibleElement) return visibleElement;
            }
            return null;
        };

        let option = findOptionElement();
        if (option) {
            option.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return true;
        }

        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        let scrollTop = 0;
        const scrollStep = Math.min(100, clientHeight);

        while (scrollTop < scrollHeight) {
            container.scrollTop = scrollTop;
            await new Promise(resolve => setTimeout(resolve, 100));
            
            option = findOptionElement();
            if (option) {
                option.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return true;
            }
            scrollTop += scrollStep;
        }
        return false;
    }"""
    try:
        found = await page.evaluate(scroll_and_find_js, text)
        if found:
            await asyncio.sleep(0.5)
            # Attempt a few known selectors for the actual clickable item:
            option_selectors = [
                f"//div[contains(@class, 'dropdown-menu')]//span[contains(text(), '{text}')]",
                f"//div[contains(@class, 'dropdown-menu')]//div[contains(text(), '{text}')]",
                f"//ul[contains(@class, 'dropdown-menu')]//li[contains(text(), '{text}')]",
                f"//div[contains(@class, 'select2-results')]//li[contains(text(), '{text}')]",
                f"//div[contains(@class, 'select2-dropdown')]//li[contains(text(), '{text}')]",
                f"//div[contains(@role, 'listbox')]//div[contains(text(), '{text}')]"
            ]
            for selector in option_selectors:
                try:
                    option = await page.wait_for_selector(selector, timeout=2000, state='visible')
                    if option:
                        await option.click()
                        await asyncio.sleep(0.5)
                        msg = f"Selected option '{text}' via scrolling/click"
                        logger.info(msg)
                        return ActionResult(extracted_content=msg, include_in_memory=True)
                except Exception as e:
                    logger.debug(f"Click attempt failed for selector {selector}: {str(e)}")
    except Exception as e:
        logger.info(f"Scroll approach failed: {str(e)}")

    # 5) Final fallback: direct typing + enter
    try:
        await element_handle.click()
        await asyncio.sleep(0.3)
        await element_handle.type(text, delay=50)
        await asyncio.sleep(0.3)
        await page.keyboard.press("Enter")
        await asyncio.sleep(0.5)
        
        msg = f"Selected option '{text}' using direct typing + enter"
        logger.info(msg)
        return ActionResult(extracted_content=msg, include_in_memory=True)
    except Exception as e:
        return ActionResult(error=f"Could not select custom dropdown item '{text}' on index {index}: {str(e)}")

###############################################################################
# Iterative form-filling logic
###############################################################################

async def fill_fields_iteratively(agent: Agent):
    """
    Repeatedly fetches the unfilled required fields from the form,
    filling them one by one. 
    """
    max_rounds = 25
    round_count = 0

    while round_count < max_rounds:
        round_count += 1

        # 1) Retrieve unfilled fields
        unfilled_response = await agent.execute_action(
            "get_unfilled_required_fields",
            {},
        )
        if unfilled_response.error:
            logger.info(f"Failed to get unfilled fields: {unfilled_response.error}")
            break

        data_raw = unfilled_response.extracted_content
        if not data_raw:
            logger.info("get_unfilled_required_fields returned no content. Exiting fill logic.")
            break
        
        try:
            unfilled_data = json.loads(data_raw)
        except:
            logger.info(f"Could not parse unfilled fields JSON: {data_raw}")
            break

        unfilled_list = unfilled_data.get("unfilled_fields", [])
        if not unfilled_list:
            logger.info("No more unfilled required fields. Form may be complete.")
            break

        logger.info(f"Round {round_count}: Found {len(unfilled_list)} unfilled fields.")
        # 2) fill them one by one
        for field_info in unfilled_list:
            field_id = field_info["id"]
            field_type = field_info["type"].lower()
            label = field_info.get("label", "")
            logger.info(f"Filling field: {field_id}, type={field_type}, label='{label}'")

            highlight_index = await find_highlight_index_for_field(agent, field_id, label)
            if highlight_index is None:
                logger.info(f"Could not find highlight index for field {field_id}. Skipping.")
                continue

            if field_type in ["text", "textarea"]:
                if "name" in label.lower():
                    text_to_input = candidate_global_data.get("name", "John Doe")
                elif "email" in label.lower():
                    text_to_input = candidate_global_data.get("email", "john@example.com")
                elif "phone" in label.lower():
                    text_to_input = candidate_global_data.get("phone", "+1-202-555-0147")
                elif "address" in label.lower():
                    text_to_input = candidate_global_data.get("address", "")
                else:
                    text_to_input = "Lorem Ipsum"  # fallback

                params = {
                    "index": highlight_index,
                    "text": text_to_input,
                }
                await agent.execute_action(
                    "input_text_with_retry",
                    params,
                )

            elif field_type in ["select-one", "select"]:
                if "how did you hear" in label.lower():
                    text_choice = "LinkedIn"
                elif "phone device" in label.lower():
                    text_choice = "Mobile"
                else:
                    text_choice = "Yes"

                # First try the built-in
                res_normal = await agent.execute_action(
                    "select_dropdown_option",
                    {"index": highlight_index, "value": text_choice},
                )
                if res_normal.error:
                    logger.info(f"Normal select_dropdown_option failed: {res_normal.error}")
                    # fallback
                    res_custom = await agent.execute_action(
                        "custom_select_dropdown_option",
                        {"index": highlight_index, "text": text_choice},
                    )
                    if res_custom.error:
                        logger.info(f"Custom select also failed: {res_custom.error}")

            elif field_type in ["checkbox", "radio"]:
                await agent.execute_action(
                    "click_element",
                    {"index": highlight_index},
                )
            
            elif field_type == "file":
                await agent.execute_action(
                    "upload_resume_file",
                    {"index": highlight_index},
                )
            else:
                logger.info(f"Unsupported field type {field_type}, skipping.")

            # After each fill, track changes
            await agent.execute_action("track_form_changes", {})
    # end while
    logger.info("Done with fill_fields_iteratively.")


async def find_highlight_index_for_field(agent: Agent, field_id: str, label: str) -> Optional[int]:
    """
    A naive approach to find the highlight index from the agent's current DOM,
    by searching for the element whose textual content or attributes match the
    'field_id' or 'label' snippet.
    """
    state = await agent.browser_context.get_state()
    for idx, dom_el in state.selector_map.items():
        text_repr = dom_el.get_all_text_till_next_clickable_element(max_depth=0).lower()
        if field_id.lower() in dom_el.xpath.lower() or label.lower() in text_repr:
            return idx
    return None

############################################
# Main function / agent code
############################################

async def run_job_application(job_url: str, candidate_profile: CandidateProfile):
    """
    1) Spin up a Browser
    2) Create an Agent with an instructive 'task'
    3) Possibly do a login if needed (the agent can decide to call "perform_login_flow")
    4) The agent first navigates to the job URL, then calls fill_fields_iteratively
    5) If there's a final "Submit" button, we attempt to click it
    """

    global candidate_global_data
    candidate_global_data = candidate_profile.model_dump()

    # Create the browser
    browser = Browser(
        config=BrowserConfig(
            headless=False,
            disable_security=True,
            extra_chromium_args=[
                "--start-maximized",
                "--disable-blink-features=AutomationControlled",
                "--disable-web-security",
                "--disable-site-isolation-trials",
            ],
            new_context_config=BrowserContextConfig(
                highlight_elements=True,
                viewport_expansion=800,
                wait_between_actions=1.0,
                minimum_wait_page_load_time=2.0,
                maximum_wait_page_load_time=15.0,
                wait_for_network_idle_page_load_time=3.0,
            )
        )
    )

    agent = None
    try:
        # We'll define a prompt that instructs the agent:
        #   - open the job url
        #   - if needed, attempt to login using "perform_login_flow"
        #   - fill out the application form using fill_fields_iteratively approach
        instructions_for_agent = f"""
1. If you see you are on a known site that requires login (like LinkedIn, Indeed),
   call 'perform_login_flow' with the site name to login first.
2. Navigate to: {job_url}
3. Accept cookies or popups.
4. If a button or link says 'Apply' or 'Application', click it to reveal the form.
    - on job boards like linkedin or indeed, you may need to navigate to the actual application page on the hiring company's website to proceed with the application.
    - DO NOT ATTEMPT TO LOGIN ON THIRD PARTY COMPANY PAGES. ONLY LOGIN ON JOB BOARDS. On company pages, find the real apply button and click it.
5. We'll fill the form in an iterative approach.
    - If there are any prefilled fields/dropdown/checkboxes/uploads that match your information, do not change them, proceed to the next field/page
    - Pay special attention to dropdowns and use all your different options of filling them if you struggle. Once you have successfully filled a field, move on to the next one.
    - make sure to upload the CV/resume as soon as you see the upload button
    - proceed top to bottom on the page, do not skip any fields
    - make sure not to leave any dropdowns or checkboxes unchecked
    - do not navigate away from the page, unless you see a 'Submit' or 'Send' button
6. After we fill, if there's a 'Submit' or 'Send' button, click it.
7. Provide final summary or logs if needed.
Note:
 - if there is an easy apply option, use it and do not change prefilled fields, try to proceed as quickly as possible 
 - on job boards like linkedin or indeed, you may need to navigate to the actual application page on the hiring company's website to proceed with the application.
 - Use get_candidate_profile to see candidate data
 - Use fill_fields_iteratively (which calls get_unfilled_required_fields, track_form_changes, etc.)
 - If we see a final 'Submit' button, click it.
    - make sure to scroll all the way to the bottom of the page if you struggle finding the apply button.
 - If the form is multi-step, proceed carefully step by step.
 - If you encounter login, call `get_login_credentials` with the detected site name.
"""


        agent = Agent(
            task=instructions_for_agent,
            llm=ChatOpenAI(model="gpt-4o", temperature=0),
            browser=browser,
            controller=controller,
            max_actions_per_step=6,
            use_vision=True
        )

        # 1) Start the agent's main instructions
        await agent.run(max_steps=50)

        # 2) Fill fields iteratively
        await fill_fields_iteratively(agent)

        # 3) Attempt to find "Submit" or "Send" or "Finish" button
        final_state = await agent.browser_context.get_state()
        for idx, el in final_state.selector_map.items():
            text_in_el = el.get_all_text_till_next_clickable_element(max_depth=0).lower()
            if any(x in text_in_el for x in ["submit", "apply", "send", "complete", "finish"]):
                logger.info(f"Found potential submit button at index {idx}, text: {text_in_el}")
                # click it:
                await controller.execute_action(
                    "click_element",
                    {"index": idx},
                    agent.browser_context
                )
                await asyncio.sleep(3)  # Wait for submission to complete
                break

        # After form submission, wait a moment for any final page loads
        await asyncio.sleep(3)
        logger.info("Done with application flow. Browser-use will create GIF automatically.")
            
    except Exception as e:
        logger.error(f"Error in agent run: {str(e)}")
        raise
    finally:
        if agent:
            await agent.browser_context.close()
        logger.info("Closing browser.")
        await browser.close()

def load_candidate_data(candidate_json_path: str) -> Dict[str, Any]:
    """
    Load candidate JSON from the path and parse as dictionary.
    """
    with open(candidate_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data


def load_login_credentials(credentials_json_path: str):
    """
    Load the site login credentials from an external JSON file or environment variable.
    Example structure:
    {
      "LinkedIn": {
         "username": "myLinkedInUser",
         "password": "myLinkedInPass"
      },
      "Indeed": {
         "username": "myIndeedUser",
         "password": "myIndeedPass"
      }
    }
    """
    global login_credentials_data
    if not os.path.exists(credentials_json_path):
        logger.info("No login credentials file found, skipping.")
        return
    
    logger.info(f"Loading credentials from: {credentials_json_path}")
    with open(credentials_json_path, "r") as f:
        login_credentials_data = json.load(f)
    logger.info(f"Available sites in credentials: {list(login_credentials_data.keys())}")
    logger.info(f"Loaded login credentials for {len(login_credentials_data)} site(s).")


def main():
    load_dotenv()

    parser = argparse.ArgumentParser(description="Improved job application script using browser_use, with login support.")
    parser.add_argument("--job_url", required=True, help="Job posting URL or site with the application form.")
    parser.add_argument("--candidate_json_path", required=True, help="Path to the JSON file with resume, name, etc.")
    parser.add_argument("--credentials_json_path", required=False, default="", help="Path to a JSON file with login credentials for various sites.")
    args = parser.parse_args()

    # load candidate
    raw_data = load_candidate_data(args.candidate_json_path)
    candidate_profile = CandidateProfile(**raw_data)

    # Update to use model_dump() instead of dict()
    global candidate_global_data
    candidate_global_data = candidate_profile.model_dump()

    # load optional login credentials
    if args.credentials_json_path:
        load_login_credentials(args.credentials_json_path)

    asyncio.run(run_job_application(args.job_url, candidate_profile))


if __name__ == "__main__":
    main()
