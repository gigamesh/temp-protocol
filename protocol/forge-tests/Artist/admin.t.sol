// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.14;

import '../TestConfig.sol';
import '@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol';

contract Artist_admin is TestConfig {
    bytes32 public constant ADMIN_ROLE = keccak256('ADMIN');

    // Owner can grant admin role
    function test_grantRoleSuccess() public {
        for (uint256 i = 1; i < 100; i++) {
            address newAdmin = vm.addr(i);

            vm.prank(ARTIST1_ADDRESS);
            artistContract.grantRole(ADMIN_ROLE, newAdmin);

            bool hasRole = artistContract.hasRole(ADMIN_ROLE, newAdmin);

            assert(hasRole);
        }
    }

    // Owner can revoke admins
    function test_revokeRoleSuccess() public {
        for (uint256 i = 1; i < 100; i++) {
            address newAdmin = vm.addr(i);

            vm.startPrank(ARTIST1_ADDRESS);
            artistContract.grantRole(ADMIN_ROLE, newAdmin);

            bool hasRole = artistContract.hasRole(ADMIN_ROLE, newAdmin);

            assert(hasRole);

            artistContract.revokeRole(ADMIN_ROLE, newAdmin);

            bool stillHasRole = artistContract.hasRole(ADMIN_ROLE, newAdmin);

            assert(!stillHasRole);

            vm.stopPrank();
        }
    }

    // Prevents non-owner from granting a role
    function test_grantRoleOnlyOwner() public {
        for (uint256 i = 1; i < 100; i++) {
            address attacker = vm.addr(i);

            vm.prank(attacker);
            vm.expectRevert(bytes('Ownable: caller is not the owner'));
            artistContract.grantRole(ADMIN_ROLE, attacker);
        }
    }

    // Prevents non-owner from revoking a role
    function test_revokeRoleOnlyOwner() public {
        for (uint256 i = 1; i < 100; i++) {
            address someAddress = vm.addr(i);

            vm.prank(ARTIST1_ADDRESS);
            artistContract.grantRole(ADMIN_ROLE, someAddress);

            vm.prank(someAddress);
            vm.expectRevert(bytes('Ownable: caller is not the owner'));
            artistContract.revokeRole(ADMIN_ROLE, someAddress);
        }
    }

    // Admins can call protected functions
    function test_adminsCanCallProtectedFuncs() public {
        uint32 someNumber = 8675309;

        // Create an edition
        createEdition(10);

        for (uint256 i = 1; i < 100; i++) {
            // Create an admin
            address newAdmin = vm.addr(i);

            // Grant admin access
            vm.prank(ARTIST1_ADDRESS);
            artistContract.grantRole(ADMIN_ROLE, newAdmin);

            // Call protected functions as admin
            vm.startPrank(newAdmin);
            artistContract.setStartTime(EDITION_ID, someNumber);
            artistContract.setEndTime(EDITION_ID, someNumber);
            artistContract.setPermissionedQuantity(EDITION_ID, someNumber);
            vm.stopPrank();

            (, , , , , uint32 startTime, uint32 endTime, uint32 permissionedQuantity, , ) = artistContract.editions(
                EDITION_ID
            );

            assertEq(startTime, someNumber);
            assertEq(endTime, someNumber);
            assertEq(permissionedQuantity, someNumber);
        }
    }

    // AccessManager protects protected functions
    function test_nonAdminsCantCallProtectedFuncs() public {
        for (uint256 i = 1; i < 100; i++) {
            // Create an attacker
            address attacker = vm.addr(i);

            uint32 someNumber = 8675309;

            // Call protected functions as attacker
            vm.startPrank(attacker);

            vm.expectRevert(bytes('unauthorized'));
            artistContract.setStartTime(EDITION_ID, someNumber);

            vm.expectRevert(bytes('unauthorized'));
            artistContract.setEndTime(EDITION_ID, someNumber);

            vm.expectRevert(bytes('unauthorized'));
            artistContract.setPermissionedQuantity(EDITION_ID, someNumber);

            vm.stopPrank();
        }
    }
}
