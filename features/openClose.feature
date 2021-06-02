Feature: Open
  As a user of TiddlyGit
  I want to open the app
  So I can be more productive

  Scenario: Opening TiddlyGit
    Given the app is launched
    Then the element "#new-user-tip" is on the page
    Then the element "#add-workspace-button" is on the page

  Scenario: Opening Add Workspace Page
    Given the app is launched
    Then the element "#add-workspace-button" is on the page
    Then click on this element
    Then "Add Workspace" window show up

  Scenario: Opening Preferences Page
    Given the app is launched
    Then the element "#open-preferences-button" is on the page
    Then click on this element
    Then "Preferences" window show up

  Scenario: Opening Notifications Page
    Given the app is launched
    Then the element "#open-notification-settings-button" is on the page
    Then click on this element
    Then "Notifications" window show up