// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.14;

import '../TestConfig.sol';

contract Artist_timing is TestConfig {
    enum TimeType {
        START,
        END
    }

    event AuctionTimeSet(TimeType timeType, uint256 editionId, uint32 indexed newTime);

    /***********************************
            setStartTime Tests
    ***********************************/

    // Artist.setStartTime only allows owner or admin to call function
    function test_setStartTimeAuthorization(uint32 privateKey) public {
        vm.assume(privateKey > 100);

        address caller = vm.addr(privateKey);

        vm.prank(caller);
        vm.expectRevert(bytes('unauthorized'));

        artistContract.setStartTime(EDITION_ID, 0);
    }

    // Artist.setStartTime sets the start time for the edition
    function test_setStartTimeSuccess() public {
        uint32 startTime = 123456789;

        (, , , , , uint32 originalStartTime, , , , ) = artistContract.editions(EDITION_ID);

        vm.prank(ARTIST1_ADDRESS);
        artistContract.setStartTime(EDITION_ID, startTime);

        (, , , , , uint32 newStartTime, , , , ) = artistContract.editions(EDITION_ID);

        assert(originalStartTime != startTime);
        assertEq(newStartTime, startTime);
    }

    // Artist.setStartTime emits event
    function test_setStartTimeEmitsEvent() public {
        uint32 startTime = 123456789;

        // Set up event to compare to
        vm.expectEmit(true, false, false, true);
        emit AuctionTimeSet(TimeType.START, EDITION_ID, startTime);

        vm.prank(ARTIST1_ADDRESS);
        artistContract.setStartTime(EDITION_ID, startTime);
    }

    /***********************************
            setEndTime Tests
    ***********************************/

    // Artist.setEndTime only allows owner or admin to call function
    function test_setEndTimeOnlyAuthorization(uint32 privateKey) public {
        vm.assume(privateKey > 100);

        address caller = vm.addr(privateKey);

        vm.prank(caller);
        vm.expectRevert(bytes('unauthorized'));

        artistContract.setEndTime(EDITION_ID, 0);
    }

    // Artist.setEndTime sets the end time for the edition
    function test_setEndTimeSuccess() public {
        uint32 endTime = 123456789;

        (, , , , , , uint32 originalEndTime, , , ) = artistContract.editions(EDITION_ID);

        vm.prank(ARTIST1_ADDRESS);
        artistContract.setEndTime(EDITION_ID, endTime);

        (, , , , , , uint32 newEndTime, , , ) = artistContract.editions(EDITION_ID);

        assert(originalEndTime != endTime);
        assertEq(newEndTime, endTime);
    }

    // Artist.setEndTime emits event
    function test_setEndTimeEmitsEvent() public {
        uint32 sendTime = 123456789;

        // Set up event to compare to
        vm.expectEmit(true, false, false, true);
        emit AuctionTimeSet(TimeType.END, EDITION_ID, sendTime);

        vm.prank(ARTIST1_ADDRESS);
        artistContract.setEndTime(EDITION_ID, sendTime);
    }
}
